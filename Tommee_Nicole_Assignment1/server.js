/* 
* Nicole Tommee
* Displays product data, validates the input, and presents an invoice 
* Used code from Lab13 Ex4 & Assignment1_MVC_server for guidance
*/

var express = require('express');
var app = express();
var myParser = require("body-parser");
var fs = require('fs');

// get the body
app.use(express.urlencoded({ extended: true }));

// takes product information from json and stores in var products
var products = require('./products.json');
// keep track of quantity sold 
products.forEach((prod, i) => { prod.total_sold = 0 });

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

/*app.post("/process_form", function (request, response) {
    response.send(request.body);
});
*/
app.post("/process_form", function (request, response, next) {
    let POST = request.body;
    // if you try to direct to the invoice page without having clicked the purchase button, show the error message
    if (typeof POST['purchase_submit'] == 'undefined') {
        response.send("Please purchase some items first!");
        console.log('No purchase form data');
        next();
    }

    console.log(Date.now() + ': Purchase made from ip ' + request.ip + ' data: ' + JSON.stringify(POST));

    var contents = fs.readFileSync('./invoice.template', 'utf8');
    response.send(eval('`' + contents + '`')); // render template string

    function display_invoice_table_rows() {
        subtotal = 0;
        str = '';
        for (i = 0; i < products.length; i++) {
            a_qty = 0;
            if (typeof POST[`quantity${i}`] != 'undefined') {
                a_qty = POST[`quantity${i}`];
            }
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

// route all other GET requests to files in public 
app.use(express.static('./public')); // essentially replaces http-server

// start server
app.listen(8080, () => console.log(`listening on port 8080`)); // note the use of an anonymous function here to do a callback

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