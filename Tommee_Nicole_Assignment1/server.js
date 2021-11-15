var express = require('express');
var app = express();

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

// process purchase request (validate quantities, check quantity available) 
app.post('/process_form', function (request, response, next) {
    for (i = 0; i < products.length; i++) {
        let name = products[i]['name'];
        let name_price = products[i]['price'];
        var q = request.body[`quantity${i}`];
        if (typeof q != 'undefined') {
            if (isNonNegInt(q)) {
                products[0].total_sold += Number(q);
                response.send(`Thank you for purchasing ${q} ${name}. Your total is \$${q * name_price}!`);
            } else {
                response.send(`Error: ${q} is not a quantity. Hit the back button to fix..`)
            }
        } else {
            response.send(`Hey! You need to pick some stuff!`)
        };
        next();
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



