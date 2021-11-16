// var users_reg_data = require('./user_data.json');
const fs = require('fs');

var filename = 'user_data.json';
var user_data_str = fs.readFileSync(filename, 'utf-8'); // reads content of the file and returns as a string
var user_data_obj = JSON.parse(user_data_str);

console.log(user_data_obj, typeof user_data_obj);