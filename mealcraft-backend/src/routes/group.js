const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
/* Mounted in app.js as app.use('/api/group', this router). Full paths:
   GET    /api/group/nearby?latitude=&longitude=
   POST   /api/group/create
   POST   /api/group/:group_id/join
   DELETE /api/group/:group_id/leave
   GET    /api/group/:group_id/messages
   GET    /api/group/:group_id
   All routes use authMiddleware — send Authorization: Bearer <token>.
*/
/** MySQL `eat_time` is TIME — ISO date strings must be converted or INSERT fails. */
function normalizeEatTimeForMysql(value) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(':');
    const h = String(parts[0]).padStart(2, '0');
    const m = String(parts[1] ?? '0').padStart(2, '0');
    const sec = parts[2] != null ? String(parts[2]).padStart(2, '0') : '00';
    return `${h}:${m}:${sec}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

// Helper: calculate distance between two coordinates (km)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET nearby open groups
// GET nearby open groups
router.get('/nearby', authMiddleware, async (req, res) => {
    const { latitude, longitude } = req.query;
  
    if (!latitude || !longitude)
      return res.status(400).json({ message: 'Location required' });
  
    try {
      const [groups] = await pool.query(`
        SELECT 
          g.group_id,
          g.title_ui,
          g.cuisine_tag,
          g.eat_time,
          g.address,
          g.latitude,
          g.longitude,
          g.status,
          g.join_window_minutes,
          g.created_at,
          COUNT(m.user_id) AS member_count,
          DATE_ADD(g.created_at, INTERVAL g.join_window_minutes MINUTE) AS closes_at
        FROM GroupOrder g
        LEFT JOIN GroupOrderMember m ON g.group_id = m.group_id
        WHERE g.status = 'open'
        AND NOW() < DATE_ADD(g.created_at, INTERVAL g.join_window_minutes MINUTE)
        GROUP BY g.group_id
        ORDER BY g.eat_time ASC
      `);
  
      const nearby = groups.filter(g =>
        getDistance(
          parseFloat(latitude), parseFloat(longitude),
          parseFloat(g.latitude), parseFloat(g.longitude)
        ) <= 5
      ).map(g => ({
        ...g,
        distance_km: getDistance(
          parseFloat(latitude), parseFloat(longitude),
          parseFloat(g.latitude), parseFloat(g.longitude)
        ).toFixed(2)
      }));
  
      res.json({ groups: nearby });
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch nearby groups' });
    }
  });


// POST create a new group
/// TODO: Check if we want to force creater to choose restaurant, delivery platform right away 
// POST create a new group
router.post('/create', authMiddleware, async (req, res) => {
    const user_id = req.user.user_id;
    const b = req.body || {};
    const title_ui = b.title_ui ?? b.titleUi ?? 'Untitled';
    const cuisine_tag = b.cuisine_tag ?? b.cuisineTag ?? null;
    const eat_time = normalizeEatTimeForMysql(b.eat_time ?? b.eatTime);
    const address = b.address ?? null;
    const latitude = b.latitude != null && b.latitude !== '' ? Number(b.latitude) : null;
    const longitude = b.longitude != null && b.longitude !== '' ? Number(b.longitude) : null;
    const join_window_minutes = Number(b.join_window_minutes ?? b.joinWindowMinutes) || 10;

    try {
      const [result] = await pool.query(`
        INSERT INTO GroupOrder 
          (creator_user_id, title_ui, cuisine_tag, eat_time,
           address, latitude, longitude, join_window_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [user_id, title_ui, cuisine_tag, eat_time,
          address, latitude, longitude,
          join_window_minutes]);
  
      await pool.query(
        'INSERT INTO GroupOrderMember (group_id, user_id) VALUES (?, ?)',
        [result.insertId, user_id]
      );
  
      res.status(201).json({
        message: 'Group created',
        group_id: result.insertId
      });
    } catch (err) {
      console.error('create group:', err.code, err.sqlMessage || err.message);
      res.status(500).json({ message: 'Failed to create group' });
    }
  });


// POST join a group
router.post('/:group_id/join', authMiddleware, async (req, res) => {
  const user_id = req.user.user_id;
  const { group_id } = req.params;
  try {
    // Check group is still open
    const [groups] = await pool.query(`
      SELECT * FROM GroupOrder 
      WHERE group_id = ? AND status = 'open'
      AND NOW() < DATE_ADD(created_at, INTERVAL join_window_minutes MINUTE)
    `, [group_id]);

    if (groups.length === 0)
      return res.status(400).json({ message: 'Group is no longer open' });

    await pool.query(
      'INSERT IGNORE INTO GroupOrderMember (group_id, user_id) VALUES (?, ?)',
      [group_id, user_id]
    );

    res.json({ message: 'Joined group successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to join group' });
  }
});

// DELETE leave a group
router.delete('/:group_id/leave', authMiddleware, async (req, res) => {
  const user_id = req.user.user_id;
  const { group_id } = req.params;
  try {
    await pool.query(
      'DELETE FROM GroupOrderMember WHERE group_id = ? AND user_id = ?',
      [group_id, user_id]
    );
    res.json({ message: 'Left group successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to leave group' });
  }
});

// GET chat messages — must be registered before GET /:group_id so /:group_id never
// steals paths like /123/messages (Express matches in order; safer with deeper paths first).
router.get('/:group_id/messages', authMiddleware, async (req, res) => {
  const { group_id } = req.params;
  try {
    const [messages] = await pool.query(`
      SELECT m.message_id, m.content, m.created_at,
             u.user_id, u.name
      FROM Message m
      JOIN User u ON m.user_id = u.user_id
      WHERE m.group_id = ?
      ORDER BY m.created_at ASC
    `, [group_id]);

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// GET group details + members
router.get('/:group_id', authMiddleware, async (req, res) => {
  const { group_id } = req.params;
  try {
    const [groups] = await pool.query(
      'SELECT * FROM GroupOrder WHERE group_id = ?', [group_id]
    );
    if (groups.length === 0)
      return res.status(404).json({ message: 'Group not found' });

    const [members] = await pool.query(`
      SELECT u.user_id, u.name
      FROM GroupOrderMember m
      JOIN User u ON m.user_id = u.user_id
      WHERE m.group_id = ?
    `, [group_id]);

    res.json({ group: groups[0], members });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch group' });
  }
});

module.exports = router;