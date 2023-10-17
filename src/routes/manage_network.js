const express = require('express');
const router = express.Router();
require('dotenv').config();

var _ = require('lodash');

// 핑퐁
router.get('/ping', async (req, res) => {
    res.status(200).json({ message: 'Pong!' });
});
module.exports = router;
