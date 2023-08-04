var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', { title: 'Express' });
});

router.use('/user', require('./user'));
router.use('/travelCourse', require('./travel_course'));
router.use('/comment', require('./comment'));
router.use('/ai', require('./ai'));
router.use('/regionSearch', require('./region_search'));

module.exports = router;
