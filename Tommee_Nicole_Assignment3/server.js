/* 
* Nicole Tommee
* Displays product data, validates the input, & then validates login information, and presents user a personalized invoice.
* Used code from Lab13 Ex4, Lab 14 Ex4, Assignment1_MVC_server, and Assignemnt 3 Examples for guidance
*/

var express = require('express');
var app = express();
var fs = require('fs');
const QueryString = require('qs');
var errors = {}; // keep errors on server to share with registration page
var loginerrors = {} // keep errors on server to share with login page

var cookieParser = require('cookie-parser');
var session = require('express-session');
var products_data = require('./products.json');

app.use(session({ secret: "MySecretKey", resave: true, saveUninitialized: true }));


app.all('*', function (request, response, next) {
    console.log(`Got a ${request.method} to path ${request.path}`);
    // need to initialize an object to store the cart in the session. We do it when there is any request so that we don't have to check it exists
    // anytime it's used
    if (typeof request.session.cart == 'undefined') { request.session.cart = {}; }
    next();
});

// get the body - if you get a POST request from a URL it will put the request in the body so you can use the data
app.use(express.urlencoded({ extended: true }));

// takes product information from json and stores in var products
// var products = require('./products.json');
const { URL, URLSearchParams } = require('url');
const { request } = require('http');
const { cookie } = require('express/lib/response');

// monitor all requests
app.all('*', function (request, response, next) {
    console.log(request.method + 'to path' + request.path + 'query string' + JSON.stringify(request.query));
    next();
});

app.post("/get_products_data", function (request, response) {
    response.json(products_data);
});

app.get("/get_cart", function (request, response) {
    response.json(request.session.cart);
});


// routing
app.get("/product_data.js", function (request, response, next) {
    response.type('.js');
    var products_str = `var products_data = ${JSON.stringify(products_data)};`;
    response.send(products_str);
});

app.post("/add_to_cart", function (request, response, next) {
    let POST = request.body;
    var products_key = request.body['products_key']; // get the product key sent from the form post
    console.log(products_key)

    // Validations 
    var errors = {}; //assume no errors to start
    var empty = true // assume no quantities entered

    for (let i in products_data[products_key]) {
        q = POST['quantity' + i];
        if (isNonNegInt(q) == false) {
            errors['invalid' + i] = `${q} is not a valid quantity for ${products_data[products_key][i].name}`;
        }

        if (q > products_data[products_key][i].quantity_available) {
            errors['quantity' + i] = `${q} items are not available for ${products_data[products_key][i].name}`;
        }
        if (q > 0) {
            empty = false;
            console.log("Some quantities inputted.")
        } else if ((typeof errors['invalid'+ i] != 'undefined') && (typeof errors['quantity'+i] != 'undefined')){
            errors['empty'] = `Please enter some quantities.`;
            console.log("Please enter some quantities.");
        }
    }
    
    // if there are errors, display each error on a new line
    if (Object.keys(errors).length > 0) {
        var errorMessage_str = '';
        for (err in errors) {
            errorMessage_str += errors[err] + '\n';
        }
        // response.redirect(`./products_display.html?errorMessage=${errorMessage_str}&` + JSON.stringify(POST));
        let params = new URLSearchParams(request.body);
        params.append('errorMessage', errorMessage_str);
        response.redirect(`./products_display.html?${params.toString()}`);
    } else {
        // if there are no errors, put quanties into session.cart
            if (typeof request.session.cart == 'undefined') {
                request.session.cart = {}; // creates a new cart if there isn't already one 
            }
            request.session.cart[products_key] = request.body;
            console.log(request.session);
        // go back to product page
        let params = new URLSearchParams(request.body);
        // params.append('errors', JSON.stringify(errors));
    }
    let params = new URLSearchParams(request.body);
    params.append('products_key', products_key);
    response.redirect(`./products_display.html?${params.toString()}`);
});


var filename = 'user_data.json';
if (fs.existsSync(filename)) {
    // have user_data file, so read data and parse into users_reg_data object
    let user_data_str = fs.readFileSync(filename, 'utf-8'); // reads content of the file and returns as a string
    var users_reg_data = JSON.parse(user_data_str); // parses into oject and stores in users_reg_data
    var file_stats = fs.statSync(filename);
} else {
    console.log(`Hey! ${filename} does not exist!`)
}

app.post("/purchase_items"), function(request,response){
    response.redirect("./invoice.html");
}

app.get("/register", function (request, response) {
    let params = new URLSearchParams(request.query);
    // Give a simple register form
    var str = generate_register_page(params);
    response.send(str);
});

app.post("/register", function (request, response) {
    let params = new URLSearchParams(request.query);
    errors = {}; // start with no errors
    username = request.body['username'].toLowerCase();
    // process a simple register form
    if (typeof users_reg_data[username] != 'undefined') { // if the username already exists
        errors['username_taken'] = `Hey! ${username} is already registered!`;
    }
    if (request.body.password != request.body.repeat_password) { //password doesn't match
        errors['password_mismatch'] = `Repeat password not the same as password!`;
    }
    if (request.body.username == '') { // no username input
        errors['no_username'] = `You need to enter a username!`;
    }
    if (request.body.fullname == '') { // no name input
        errors['no_name'] = `You need to enter a name!`;
    }
    if (request.body.email == '') { // no email input
        errors['no_email'] = `You need to enter an email!`;
    }

    // Referenced code from https://www.w3spoint.com/spaces-letters-alphabets-validation-javascript-js
    // Full name - only letters
    var alphabet = /^[a-zA-Z\s]*$/;
    if (alphabet.test(request.body.fullname)) {
    } else {
        errors['nameError'] = `Name must have alphabet characters only`;
    }

    // Username - only numbers and characters are valid 
    var letters = /^[0-9a-zA-Z]+$/;
    if (letters.test(username)) {
    } else {
        errors['validateUser'] = `Username must have alphabet and numerical characters only`;
    }

    // Referenced code from https://www.w3resource.com/javascript/form/email-validation.php
    // Email validation
    var emailCharacters = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (emailCharacters.test(request.body.email)) {
    } else {
        errors['emailError'] = 'Please enter a valid email address in the following format: user@host.com'
    }

    // Username must be between 4-10 characters. Already set maxlength to 10, so just make sure it's at least 4 characters
    if (request.body.username.length < 4) {
        errors['validateUser'] = `Username must be at least 4 characters`;
    }

    // Password should have a minimum of 6 characters 
    if (request.body.password.length < 6) {
        errors['validatePassword'] = `Password must be at least 6 characters`;
    }

    // if no errors, continue to register the new user
    if (Object.keys(errors).length == 0) {
        // new object for the username
        users_reg_data[username] = {};
        // set password
        users_reg_data[username].password = request.body['password'];
        // set email
        users_reg_data[username].email = request.body['email'];
        // set full name
        users_reg_data[username].fullname = request.body['fullname'];
        // write the info to the JSON file
        fs.writeFileSync('./user_data.json', JSON.stringify(users_reg_data));
        // redirect to login page
        response.redirect('./login?' + params.toString());
        return;
        console.log("successfully registered") + params.toString();
    } else { // regenerate the register page with sticky form 
        var str = generate_register_page(params, { "username": username, "fullname": request.body.fullname, "email": request.body.email });
        response.send(str);
    }
});

app.get("/login", function (request, response) {
    // Give a simple login form
    let params = new URLSearchParams(request.query);
    var str = generate_login_page(params);
    response.send(str);
});

app.post("/login", function (request, response) {
    let params = new URLSearchParams(request.query);
    loginerrors = {}; // start with no errors
    // Process login form POST and redirect to logged in page if ok, back to login page if not
    let login_username = request.body['username'].toLowerCase();
    let login_password = request.body['password'];
    if (login_username == '' || (typeof users_reg_data[login_username] == 'undefined')) {
        loginerrors['user_input_error'] = `Please enter a valid username`;
    }
    // check if username exists, then check password entered matches password stored
    if (typeof users_reg_data[login_username] != 'undefined') { // if user matches what we have
        if (users_reg_data[login_username]['password'] == login_password) {
            response.cookie('username', login_username);
            console.log(`${request.cookies} is logged in`); // work on being able to display this user on the products_display page
            // redirect to the invoice, personalizing the name and email from the user logged in
            response.redirect(`./products_display.html?products_key=${"20 Inch Hello Kitty"}&fullname=${users_reg_data[login_username]['fullname']}&email=${users_reg_data[login_username]['email']}&username=${login_username}&` + params.toString());
            return; // no other code 
        } else { // if password doesn't match, redirect to the login page and add error msg to array
            loginerrors['incorrect_password'] = `Incorrect password for ${login_username}`;
        }
    }
    // if we get here, we have errors so send back to login
    var str = generate_login_page(params, { "username": login_username });
    response.send(str);
});

// route all other GET requests to files in public 
app.use(express.static('./public')); // essentially replaces http-server

// start server
app.listen(8080, () => console.log(`listening on port 8080`)); // note the use of an anonymous function here to do a callback

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

function generate_login_page(params, form_data = {}) {
    str = `
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat&display=swap');
            body{
                background-color: pink;
                font-family: 'Montserrat', sans-serif;
                text-align: center;
            }
            h1{
                margin-top: 30px;
            }
            #errorMessage {
                color: red;
            }
        </style>
        <body>
        <h1> Hello Kitty Squishmallow Login</h1>
        <form action="?${params.toString()}" method="POST" name="login_form">
        <label style = "margin-right: 193px;" for="username"><strong>Username</strong></label> <br>
        <input type="text" name="username" size="40" placeholder="enter username" 
        value="${(typeof form_data['username'] != 'undefined') ? form_data['username'] : ''}"
        ><br />
        <p id = "errorMessage">
        ${(typeof loginerrors['user_input_error'] != 'undefined') ? loginerrors['user_input_error'] : ''}
        </p>
        <br>
        <label style = "margin-right: 200px;"for="password"><strong>Password</strong></label> <br>
        <input type="password" name="password" size="40" placeholder="enter password"
        value="${(typeof form_data['password'] != 'undefined') ? form_data['password'] : ''}"
        ><br />
        <p id = "errorMessage">
        ${(typeof loginerrors['incorrect_password'] != 'undefined') ? loginerrors['incorrect_password'] : ''}
        </p>
        <br>
        <input type="submit" value="Login" id="submit" style="margin:0px auto; background-color: palevioletred;font-family: 'Montserrat', sans-serif;">
        </form>
        <strong> Don't have an account? <a href="./register?${params.toString()}">Register</a> </strong>
        </body>
        `;
    return str;
}

function generate_register_page(params, form_data = {}) {
    str = `
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat&display=swap');
    body{
        text-align: center;
        background-color: pink;
        font-family: 'Montserrat', sans-serif;
    }
    h1{
        margin-top: 30px;
    }
    #errorMessage {
        color: red;
    }
    </style>
    <body>
    <h1> Create Your Hello Kitty Squishmallow Account</h1>
    <form action="?${params.toString()}" method="POST" name="register">
    <label style = "margin-right: 190px;" for="fullname"><strong>Full Name</strong></label> <br>
    <input type="text" name="fullname" size="40" placeholder="enter full name" maxlength="30" 
    value="${(typeof form_data['fullname'] != 'undefined') ? form_data['fullname'] : ''}"
    ><br />
    <p id = "errorMessage">
    ${(typeof errors['no_name'] != 'undefined') ? errors['no_name'] : ''}
    ${(typeof errors['nameError'] != 'undefined') ? errors['nameError'] : ''}
    </p>
    <br>
    <label style = "margin-right: 40px;" for="username"><strong>Username</strong></label> 
    <label style = "font-size:12px;" for="username"> between 4-10 characters</label>
    <br>
    <input type="text" name="username" size="40" placeholder="enter username" maxlength="10"
    value="${(typeof form_data['username'] != 'undefined') ? form_data['username'] : ''}">
    <br />
    <p id = "errorMessage">
    ${(typeof errors['no_username'] != 'undefined') ? errors['no_username'] : ''}
    ${(typeof errors['username_taken'] != 'undefined') ? errors['username_taken'] : ''}
    ${(typeof errors['validateUser'] != 'undefined') ? errors['validateUser'] : ''}
    </p>
    <br />
    <label style = "margin-right: 70px;" for="username"><strong>Password</strong></label>
    <label style = "font-size:12px; text-align: left;" for="username"> at least 6 characters</label>
    <br>
    <input type="password" name="password" size="40" placeholder="enter password"><br />
    <input type="password" name="repeat_password" size="40" placeholder="enter password again"><br />
    <p id = "errorMessage">
    ${(typeof errors['password_mismatch'] != 'undefined') ? errors['password_mismatch'] : ''}
    ${(typeof errors['validatePassword'] != 'undefined') ? errors['validatePassword'] : ''}
    </p>
    <br />
    <label style = "margin-right: 235px;" for="username"><strong>Email</strong></label> <br>
    <input type="email" name="email" size="40" placeholder="enter email"
    value="${(typeof form_data['email'] != 'undefined') ? form_data['email'] : ''}">
    <br />
    <p id = "errorMessage">
    ${(typeof errors['no_email'] != 'undefined') ? errors['no_email'] : ''}
    ${(typeof errors['emailError'] != 'undefined') ? errors['emailError'] : ''}
    </p>
    <br>
    <input type="submit" value="Register" id="submit" style="margin:0px auto; background-color: palevioletred; 
    font-family: 'Montserrat', sans-serif;">
    </form>
    </body>
    `;
    return str;
}
