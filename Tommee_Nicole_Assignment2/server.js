/* 
* Nicole Tommee
* Displays product data, validates the input, validates login information, and presents an invoice 
* Used code from Lab13 Ex4, Lab 14 Ex4, and Assignment1_MVC_server for guidance
*/

var express = require('express');
var app = express();
var fs = require('fs');
const QueryString = require('qs');
const qs = require('querystring');
const { response } = require('express');
const { concatSeries } = require('async');
var errors = {}; // keep errors on server to share with registration page


// functions
function isNonNegInt(q, returnErrors = false) {
    errors = []; // assume no errors at first
    if (q == '') q = 0;
    if (Number(q) != q) errors.push('Not a number!'); // Check if string is a number value
    else {
        if (q < 0) errors.push('Negative value!'); // Check if it is non-negative
        if (parseInt(q) != q) errors.push('Not an integer!'); // Check that it is an integer
    }
    return returnErrors ? errors : (errors.length == 0);
}

// get the body
app.use(express.urlencoded({ extended: true }));

// takes product information from json and stores in var products
var products = require('./products.json');

// keep track of quantity sold 
products.forEach((prod, i) => { prod.total_avail = 0 });

// monitor all requests
app.all('*', function (request, response, next) {
    console.log(request.method + 'to path' + request.path + 'query string' + JSON.stringify(request.query));
    next();
});

// routing
app.get("/product_data.js", function (request, response, next) {
    response.type('.js');
    var products_str = `var products = ${JSON.stringify(products)};`;
    response.send(products_str);
});


app.post("/process_form", function (request, response, next) {
    let POST = request.body;
    let params = new URLSearchParams(request.body);

    // if error with submit value, show error message
    if (typeof POST['purchase_submit'] == 'undefined') {
        response.send("Please purchase some items first!");
        console.log('No purchase form data');
        next();
        return;
    }

    // Validations - assume no errors to start
    var errors = {};
    var empty = true // assume no quantities entered

    for (i in products) {
        q = POST['quantity' + i];
        if (isNonNegInt(q) == false) {
            errors['invalid' + i] = `${q} is not a valid quantity for ${products[i].name}`;
        }

        if (q > products[i].quantity_available) {
            errors['quantity' + i] = `${q} items are not available for ${products[i].name}`;
        }
        if (q > 0) {
            empty = false;
            console.log("Some quantities inputted.")
        }
    }
    // if no quantities entered
    if (empty == true) {
        errors['empty' + i] = `Please enter some quantities.`;
    }


    if (Object.keys(errors).length > 0) {
        var errorMessage_str = '';
        for (err in errors) {
            errorMessage_str += errors[err] + '\n';
        }
        response.redirect(`./products_display.html?errorMessage=${errorMessage_str}&` + QueryString.stringify(POST));
    } else {
        // quantities are valid so remove from inventory
        for (i = 0; i < products.length; i++) {
            products[i].quantity_available -= Number(POST[`quantity${i}`]);
        }
        response.redirect('./login?' + params.toString());
    }

    // shows in the console the values received 
    console.log(Date.now() + ': Purchase made from ip ' + request.ip + ' data: ' + JSON.stringify(POST));

    //response.redirect('./login');

    //var contents = fs.readFileSync('./invoice.template', 'utf8');
    //response.send(eval('`' + contents + '`')); // render template string

});


var filename = 'user_data.json';
if (fs.existsSync(filename)) {
    // have user_data file, so read data and parse into users_reg_data object
    let user_data_str = fs.readFileSync(filename, 'utf-8'); // reads content of the file and returns as a string
    var users_reg_data = JSON.parse(user_data_str); // parses into oject and stores in users_reg_data
    var file_stats = fs.statSync(filename);
    console.log(`${filename} has ${file_stats.size} characters`);
} else {
    console.log(`Hey! ${filename} does not exist!`)
}

app.use(express.urlencoded({ extended: true })); // if you get a POST request from a URL it will put the request in the body so you can use the data

app.get("/register", function (request, response) {
    let params = new URLSearchParams(request.query);
    // Give a simple register form
    str = `
        <style>
        body{
            background-color: pink;
            font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
        }
        </style>
        <body>
        <h1> Create Your Hello Kitty Squishmallow Account</h1>
        <form action="?${params.toString()}" method="POST">
        <label for="username"><strong>Username</strong></label> <br>
        <input type="text" name="username" size="40" placeholder="enter username" ><br />
        ${(typeof errors['no_username'] != 'undefined') ? errors['no_username'] : ''}
        ${(typeof errors['username_taken'] != 'undefined') ? errors['username_taken'] : ''}
        <br />
        <label for="username"><strong>Password</strong></label> <br>
        <input type="password" name="password" size="40" placeholder="enter password"><br />
        <input type="password" name="repeat_password" size="40" placeholder="enter password again"><br />
        ${(typeof errors['password_mismatch'] != 'undefined') ? errors['password_mismatch'] : ''}
        <br />
        <label for="username"><strong>Email</strong></label> <br>
        <input type="email" name="email" size="40" placeholder="enter email"><br />
        <input type="submit" value="Submit" id="submit" style="margin:0px auto; background-color: palevioletred;">
        </form>
        </body>
    `;
    response.send(str);
});

app.post("/register", function (request, response) {
    let params = new URLSearchParams(request.query);
    username = request.body['username'].toLowerCase();
    // process a simple register form
    if (typeof users_reg_data[username] != 'undefined') {
        errors['username_taken'] = `Hey! ${username} is already registered!`;
    }
    if (request.body.password != request.body.repeat_password) {
        errors['password_mismatch'] = `Repeat password not the same as password!`;
    }

    if (request.body.username == '') {
        errors['no_username'] = `You need to select a username!`;
    }
    if (Object.keys(errors).length == 0) {
        users_reg_data[username] = {};
        users_reg_data[username].password = request.body['password'];
        users_reg_data[username].email = request.body['email'];
        fs.writeFileSync('./user_data.json', JSON.stringify(users_reg_data));
        response.redirect('./login?'+ params.toString());
        console.log("successfully registered") + params.toString();
    } else {
        response.redirect("./register?" + params.toString()) ;
        console.log(errors);

    }
});

app.get("/login", function (request, response) {
    // Give a simple login form
    let params = new URLSearchParams(request.query);
    str = `
    <style>
        body{
            background-color: pink;
            font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
        }
        </style>
    <body>
    <h1> Hello Kitty Squishmallow Login</h1>
    <form action="?${params.toString()}" method="POST">
    <label for="username"><strong>Username</strong></label> <br>
    <input type="text" name="username" size="40" placeholder="enter username" ><br />
    <br>
    <label for="username"><strong>Password</strong></label> <br>
    <input type="password" name="password" size="40" placeholder="enter password"><br />
    <br>
    <input type="submit" value="Login" id="submit" style="margin:0px auto; background-color: palevioletred;">
    </form>
    <strong> Don't have an account? <a href="./register? $${params.toString()}">Register</a> </strong>
    </body>
    `;
    response.send(str);
});

app.post("/login", function (request, response) {
    let params = new URLSearchParams(request.query);
    // Process login form POST and redirect to logged in page if ok, back to login page if not
    let login_username = request.body['username'].toLowerCase();
    let login_password = request.body['password'];
    // check if username exists, then check password entered matches password stored
    if (typeof users_reg_data[login_username] != 'undefined') { // if user matches what we have
        if (users_reg_data[login_username]['password'] == login_password) {
            response.redirect('./invoice.html?' + params.toString());
        } else {
            response.redirect(`./login?err=incorrect password for ${login_username}` + params.toString());
        }
    } else {
        response.redirect(`./login?err=${login_username} does not exist` + params.toString());
    }

    response.send('Processing login' + JSON.stringify(request.body)) // request.body holds the username & password (the form data when it got posted)

});


// route all other GET requests to files in public 
app.use(express.static('./public')); // essentially replaces http-server

// start server
app.listen(8080, () => console.log(`listening on port 8080`)); // note the use of an anonymous function here to do a callback


