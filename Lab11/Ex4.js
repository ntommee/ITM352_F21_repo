// Checks to see if a string q is a non-negative integer. If returnErrors is true,  the array of errors is returned,
// Otherwise returns true if q is a non-negative integer. 
function isNonNegInt(q, returnErrors = false) {
    errors = []; // assume no errors at first
    if(q = '') {
        q = 0;
    }
    if(Number(q) != q) errors.push('Not a number!'); // Check if string is a number value
    if(q < 0) errors.push('Negative value!'); // Check if it is non-negative
    if(parseInt(q) != q) errors.push('Not an integer!'); // Check that it is an integer

    return returnErrors ? errors : (errors.length == 0);
}


var attributes  =  "Nicole;20;20.5;-19.5";
var parts = attributes.split(';');

/* Runs through every value of parts
for (part of parts) {
    console.log(`${part}.isNonNegInt: ${iisNonNegInt(part, false)}`);
}
*/


parts.forEeach((item,index) => {console.log(`part ${index} is ${(isNonNegInt(item)?'a':'not a')} quantity`);} )