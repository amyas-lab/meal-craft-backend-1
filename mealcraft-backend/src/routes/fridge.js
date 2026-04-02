// New data entity: UserFridge
const express = require('express');
const router = express.Router();
const {pool} = require('../config/db'); // Go up one level to the config folder and then to the db.js file
const authMiddleware = require('../middleware/auth');

// GET all ingredients in the user's fridge
router.get('/', authMiddleware, async (req, res) => {
    const user_id = req.user.user_id;
    try {
        const [items] = await pool.query(
            'SELECT i.ingredient_id, i.name, i.category FROM Ingredient i JOIN UserFridge uf ON i.ingredient_id = uf.ingredient_id WHERE uf.user_id = ?',
            [user_id]);
        res.json({items});
    } catch (error) {
        res.status(500).json({message: 'Failed to fetch fridge items'});
    }
});

// GET all of the available ingredients in the database
    // This helps the search bar in the frontend to show all the ingredients
router.get('/all', authMiddleware, async (req, res) => {
    try {
        const [items] = await pool.query(
            'SELECT * FROM Ingredient ORDER BY category, name');
        res.json({items});
    } catch (error) {
        res.status(500).json({message: 'Failed to fetch all ingredients'});
    }
});

// POST a new ingredient to the user's fridge
router.post('/', authMiddleware, async (req, res) => {
    const user_id = req.user.user_id;
    const { ingredient_id } = req.body;
    try {
      await pool.query( // This needs to be in try to catch the error
        'INSERT IGNORE INTO UserFridge (user_id, ingredient_id) VALUES (?, ?)',
        [user_id, ingredient_id]
      );
      res.status(201).json({ message: 'Ingredient added' });
    } catch (err) {
      res.status(500).json({ message:'Failed to add ingredient' });
    }
  });

// DELTE all ingredients from fridge
router.delete('/clear', authMiddleware, async (req, res) => {
    const user_id = req.user.user_id;
    try {
      await pool.query(
        'DELETE FROM UserFridge WHERE user_id = ?',
        [user_id]
      );
      res.json({ message: 'All ingredients removed' });
    } catch (err) {
      res.status(500).json({ message:'Failed to remove all ingredients' });
    }
  });

// DELETE remove one ingredient from fridge
router.delete('/:ingredient_id', authMiddleware, async (req, res) => {
    const user_id = req.user.user_id;
    const { ingredient_id } = req.params;
    try {
      await pool.query(
        'DELETE FROM UserFridge WHERE user_id = ? AND ingredient_id = ?',
        [user_id, ingredient_id]
      );
      res.json({ message: 'Ingredient removed' });
    } catch (err) {
      res.status(500).json({ message:'Failed to remove ingredient' });
    }
  });

module.exports = router;