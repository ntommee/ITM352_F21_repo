/* 
* Nicole Tommee
* Displays product data, validates the input, and presents an invoice 
* Used code from Lab13 Ex4 & Assignment1_MVC_server for guidance
*/

var express = require('express');
var app = express();
var fs = require('fs');
const QueryString = require('qs');
const qs = require('querystring');
const { response } = require('express');

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

    // if error with submit value, show error message
    if (typeof POST['purchase_submit'] == 'undefined') {
        response.send("Please purchase some items first!");
        console.log('No purchase form data');
        next();
        return;
    }

    // Validations - assume no errors to start
    var errors = {};

    for (i in products) {
        q = POST['quantity' + i];
        if (isNonNegInt(q) == false) {
            errors['invalid' + i] = `${q} is not a valid quantity for ${products[i].name}`;
        }

        if (q > products[i].quantity_available) {
            errors['quantity' + i] = `${q} items are not available for ${products[i].name}`;
        }
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
    }


    // shows in the console the values received 
    console.log(Date.now() + ': Purchase made from ip ' + request.ip + ' data: ' + JSON.stringify(POST));

    var contents = fs.readFileSync('./invoice.template', 'utf8');
    response.send(eval('`' + contents + '`')); // render template string

    function display_invoice_table_rows() {
        subtotal = 0;
        str = '';
        for (i = 0; i < products.length; i++) {
            a_qty = 0;
            // if the quantity is valid, store the quantity in a_qty
            if (typeof POST[`quantity${i}`] != 'undefined') {
                a_qty = POST[`quantity${i}`];
            }
            // if the quantity is greater than 0, carry out calculations for extended price & subtotal
            if (a_qty > 0) {
                // product row
                extended_price = a_qty * products[i].price
                subtotal += extended_price;
                str += (`
          <tr>
            <td width="43%">${products[i].name}</td>
            <td align="center" width="11%">${a_qty}</td>
            <td width="13%">\$${products[i].price}</td>
            <td width="54%">\$${extended_price}</td>
          </tr>
          `);
            }
        }
        // Compute tax
        tax_rate = 0.04;
        tax = tax_rate * subtotal;

        // Compute shipping
        if (subtotal <= 45) {
            shipping = 10;
        } else if (subtotal <= 100) {
            shipping = 10;
        } else {
            shipping = 0.07 * subtotal; // 7% of subtotal
        }

        // Compute grand total
        total = subtotal + tax + shipping;

        return str;
    }
});

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
    // Give a simple register form
    str = `
<body>
<form action="register" method="POST">
<input type="text" name="username" size="40" placeholder="enter username" ><br />
<input type="password" name="password" size="40" placeholder="enter password"><br />
<input type="password" name="repeat_password" size="40" placeholder="enter password again"><br />
<input type="email" name="email" size="40" placeholder="enter email"><br />
<input type="submit" value="Submit" id="submit">
</form>
</body>
    `;
    response.send(str);
});

app.post("/register", function (request, response) {
    username = request.body['username'];
    // process a simple register form
    if (typeof users_reg_data[username] == 'undefined' && (request.body['password'] == request.body['repeat_password'])) {
        users_reg_data[username] = {};
        users_reg_data[username].password = request.body['password'];
        users_reg_data[username].email = request.body['email'];

        fs.writeFileSync('./user_data.json', JSON.stringify(users_reg_data));
        response.redirect('./login');
        console.log("successfully registered");
    } else {
        response.redirect('./register');
        console.log("not registered");
    }
});

app.get("/login", function (request, response) {
    // Give a simple login form
    str = `
<body>
<form action="" method="POST">
<input type="text" name="username" size="40" placeholder="enter username" ><br />
<input type="password" name="password" size="40" placeholder="enter password"><br />
<input type="submit" value="Submit" id="submit">
</form>
</body>
`;
    response.send(str);
});

app.post("/login", function (request, response) {
    // Process login form POST and redirect to logged in page if ok, back to login page if not
    let login_username = request.body['username'];
    let login_password = request.body['password'];
    // check if username exists, then check password entered matches password stored
    if (typeof users_reg_data[login_username] != 'undefined') { // if user matches what we have
        if (users_reg_data[login_username]['password'] == login_password) {
            response.send(`${login_username} is logged in`);
        } else {
            response.redirect(`./login?err=incorrect password for ${login_username} `);
        }
    } else {
        response.redirect(`./login?err=${login_username} does not exist`);
    }

    response.send('Processing login' + JSON.stringify(request.body)) // request.body holds the username & password (the form data when it got posted)

});

// route all other GET requests to files in public 
app.use(express.static('./public')); // essentially replaces http-server

// start server
app.listen(8080, () => console.log(`listening on port 8080`)); // note the use of an anonymous function here to do a callback


