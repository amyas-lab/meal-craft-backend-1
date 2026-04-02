const express = require('express');
const router = express.Router();
const {pool} = require('../config/db'); // Go up one level to the config folder and then to the db.js file
const authMiddleware = require('../middleware/auth');

// GOAL: Get single reciple with ingredients and steps

// GET single recipe with ingredients and steps
// :recipe_id: is a dynamic parameter 
router.get('/:recipe_id', authMiddleware, async (req, res) => {
    const recipe_id = req.params.recipe_id;
    try {
        // Fetch basic data info
        const [recipes_info] = await pool.query(
            'SELECT * FROM Recipe WHERE recipe_id = ?', [recipe_id]);
        if (recipes_info.length ===0) {
            return res.status(404).json({message: 'Recipe not found'});
        }
        const recipe = recipes_info[0]; // Return the first row of the result

        // Fetch ingredients
        const [ingredients] = await pool.query(
            'SELECT i.name, ri.quantity, ri.unit FROM RecipeIngredient ri JOIN Ingredient i ON ri.ingredient_id = i.ingredient_id WHERE ri.recipe_id = ?', [recipe_id] ); 
        
            // Parse the instructions into an array of steps
        const steps = recipe.instructions
            .split('\n')
            .filter(line => line.trim() !== '')
            .map((step, index) => ({
              step_number: index + 1,
              description: step.trim()
            }));
        // Send the recipe data to the client
        res.json({
            recipe_id: recipe.recipe_id,
            name: recipe.name,
            description: recipe.description,
            ingredients: ingredients,
            steps: steps,
        });
    } catch (error) {
        res.status(500).json({message: 'Failed to fetch recipe'});
    }
});

module.exports = router;