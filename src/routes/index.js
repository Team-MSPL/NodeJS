var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', { title: 'Express' });
});

router.use('/ai', require('./ai'));
router.use('/regionSearch', require('./region_search'));
router.use('/user', require('./user'));
router.use('/travelCourse', require('./travel_course'));
router.use('/post', require('./post'));
router.use('/manageTravel', require('./manage_travel'));
router.use('/managePost', require('./manage_post'));
router.use('/manageNetwork', require('./manage_network'));
router.use('/marketing', require('./marketing'));

module.exports = router;
