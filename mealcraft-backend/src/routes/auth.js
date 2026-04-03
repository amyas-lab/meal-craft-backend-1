const express = require('express');
const router = express.Router();
// bcrypt: for hashing and salting passwords
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
    // Usage: pool.query()

// Register
 // With router.post as a listener, it will listen to the URL call and then call the function

router.post('/register', async (req, res) => {
    const { name, email, phone, password } = req.body; // Unpackaging
    try {
        const [existing] = await pool.query('SELECT * FROM User WHERE email = ? OR phone = ?', [email, phone]);
        if (existing.length > 0) {
            return res.status(400).json({message: 'Email or phone already registered'});
        } 
        const password_hash = await bcrypt.hash(password, 10); // Run 2^10 times to hash the password
        // await is to wait for the promise to resolve
        const [result] = await pool.query(
            'INSERT INTO User (name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
            [name, email, phone, password_hash],
        );

        // Create a blank preference rows to be later filled by the user
        await pool.query('INSERT INTO UserPreferences (user_id) VALUES (?)', [result.insertId]); // insertId: the ID of the last inserted row
            // insertId is a property name of the mysql12
        res.status(201).json({message: 'User registered successfully', user_id: result.insertId});

    } catch (error) {
        res.status(500).json({message: 'Registration failed'});
    }
});


router.post('/login', async(req, res) => {
    const {email, password} = req.body;
    try {
        const [user] = await pool.query(
            'SELECT * FROM User WHERE email = ?', [email]);
        // Check user
        if (user.length === 0) {
            return res.status(404).json({message: "User not found"});
        }

        // Check password
            // user is an array, so we need to access the first element
            // user[0].password: the password of the user
            // user[0]]: an object
        const valid = await bcrypt.compare(password, user[0].password_hash);
        if (!valid) {
            return res.status(401).json({message: 'Invalid password'});
        }
        // Now generate a token
        const token = jwt.sign(
            {user_id: user[0].user_id},
            process.env.JWT_SECRET,
            {expiresIn: '24h'},
        );
        // Now send the token to the user
        res.json({token, user_id: user[0].user_id, name: user[0].name});
    } catch (error) {
        res.status(500).json({message: 'Login failed'});
    }      
});

// Router recipes



module.exports = router; // Export the router so it can be used in other files
/* THE ROLE OF ROUTER
router.post('/register',...)
router.post('/login/,...)

*/ 