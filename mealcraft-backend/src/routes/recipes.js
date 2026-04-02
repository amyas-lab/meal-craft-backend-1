const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// ─── RULE: specific routes always BEFORE dynamic routes ───

// GET all recipes for home feed
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [recipes] = await pool.query(`
      SELECT recipe_id, name, cook_time, difficulty, image_url, category, kcal
      FROM Recipe
      ORDER BY created_at DESC
    `);
    res.json({ recipes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recipes' });
  }
});

// GET personalized recommendations based on user preferences
router.get('/recommended', authMiddleware, async (req, res) => {
  const user_id = req.user.user_id;
  try {
    const [prefs] = await pool.query(
      'SELECT cuisine_interests, cooking_skill_level FROM UserPreferences WHERE user_id = ?',
      [user_id]
    );

    // No preferences set — return latest recipes
    if (prefs.length === 0 || !prefs[0].cuisine_interests) {
      const [recipes] = await pool.query(`
        SELECT recipe_id, name, cook_time, difficulty, image_url, category, kcal
        FROM Recipe ORDER BY created_at DESC LIMIT 10
      `);
      return res.json({ recipes });
    }

    const interests = prefs[0].cuisine_interests.split(',').map(i => i.trim());
    const placeholders = interests.map(() => '?').join(', ');

    const [recipes] = await pool.query(`
      SELECT recipe_id, name, cook_time, difficulty, image_url, category, kcal
      FROM Recipe
      WHERE category IN (${placeholders})
      ORDER BY created_at DESC LIMIT 10
    `, interests);

    res.json({ recipes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recommendations' });
  }
});

// GET recipes matching fridge ingredients
router.get('/matching', authMiddleware, async (req, res) => {
  const user_id = req.user.user_id;
  try {
    const [fridge] = await pool.query(
      'SELECT ingredient_id FROM UserFridge WHERE user_id = ?',
      [user_id]
    );

    if (fridge.length === 0)
      return res.json({ recipes: [], message: 'Tủ lạnh của bạn đang trống' });

    const fridgeIds = fridge.map(f => f.ingredient_id);
    const placeholders = fridgeIds.map(() => '?').join(', ');

    const [recipes] = await pool.query(`
      SELECT 
        r.recipe_id,
        r.name,
        r.cook_time,
        r.difficulty,
        r.image_url,
        r.category,
        r.kcal,
        COUNT(ri.ingredient_id) AS total_ingredients,
        SUM(CASE WHEN ri.ingredient_id IN (${placeholders}) 
            THEN 1 ELSE 0 END) AS matched_ingredients,
        COUNT(ri.ingredient_id) - 
        SUM(CASE WHEN ri.ingredient_id IN (${placeholders}) 
            THEN 1 ELSE 0 END) AS missing_ingredients
      FROM Recipe r
      JOIN RecipeIngredient ri ON r.recipe_id = ri.recipe_id
      GROUP BY r.recipe_id
      HAVING matched_ingredients > 0
      ORDER BY missing_ingredients ASC, matched_ingredients DESC
    `, [...fridgeIds, ...fridgeIds]);

    const result = recipes.map(r => ({
      ...r,
      status: r.missing_ingredients === 0
        ? 'Đủ nguyên liệu ✅'
        : `Thiếu ${r.missing_ingredients} nguyên liệu`
    }));

    res.json({ recipes: result });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch matching recipes' });
  }
});

// GET recipes by category
router.get('/category/:category', authMiddleware, async (req, res) => {
  const { category } = req.params;
  try {
    const [recipes] = await pool.query(`
      SELECT recipe_id, name, cook_time, difficulty, image_url, category, kcal
      FROM Recipe
      WHERE category = ?
      ORDER BY created_at DESC
    `, [category]);
    res.json({ recipes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recipes by category' });
  }
});

// POST save a recipe to user's cookbook
router.post('/save', authMiddleware, async (req, res) => {
  const user_id = req.user.user_id;
  const { recipe_id } = req.body;
  try {
    await pool.query(
      'INSERT IGNORE INTO SavedRecipe (user_id, recipe_id) VALUES (?, ?)',
      [user_id, recipe_id]
    );
    res.status(201).json({ message: 'Recipe saved' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save recipe' });
  }
});

// DELETE unsave a recipe
router.delete('/save/:recipe_id', authMiddleware, async (req, res) => {
  const user_id = req.user.user_id;
  const { recipe_id } = req.params;
  try {
    await pool.query(
      'DELETE FROM SavedRecipe WHERE user_id = ? AND recipe_id = ?',
      [user_id, recipe_id]
    );
    res.json({ message: 'Recipe unsaved' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to unsave recipe' });
  }
});

// GET single recipe with full details ← ALWAYS LAST
router.get('/:recipe_id', authMiddleware, async (req, res) => {
  const { recipe_id } = req.params;
  try {
    const [recipes_info] = await pool.query(
      'SELECT * FROM Recipe WHERE recipe_id = ?', [recipe_id]
    );

    if (recipes_info.length === 0)
      return res.status(404).json({ message: 'Recipe not found' });

    const recipe = recipes_info[0];

    const [ingredients] = await pool.query(`
      SELECT i.name, ri.quantity, ri.unit
      FROM RecipeIngredient ri
      JOIN Ingredient i ON ri.ingredient_id = i.ingredient_id
      WHERE ri.recipe_id = ?
    `, [recipe_id]);

    const steps = recipe.instructions
      .split('\n')
      .filter(line => line.trim() !== '')
      .map((step, index) => ({
        step_number: index + 1,
        description: step.trim()
      }));

    res.json({
      recipe_id: recipe.recipe_id,
      name: recipe.name,
      cook_time: recipe.cook_time,
      difficulty: recipe.difficulty,
      image_url: recipe.image_url,
      category: recipe.category,
      kcal: recipe.kcal,
      servings: recipe.servings,
      ingredient_count: ingredients.length,
      ingredients,
      steps
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recipe' });
  }
});

module.exports = router;
/*
```

---

## Route Order Summary — Why This Order Matters
```
GET  /                    ✅ static
GET  /recommended         ✅ static
GET  /matching            ✅ static
GET  /category/:category  ✅ semi-dynamic
POST /save                ✅ static
DELETE /save/:recipe_id   ✅ semi-dynamic
GET  /:recipe_id          ⚠️ wildcard — always last
```

Replace the file, restart server, then test these new endpoints in Postman:
```
GET  http://localhost:3000/api/recipes
GET  http://localhost:3000/api/recipes/recommended
GET  http://localhost:3000/api/recipes/matching
POST http://localhost:3000/api/recipes/save  → { "recipe_id": 1 }
*/