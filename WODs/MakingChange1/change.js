// amount we want change for in pennies
var amount = 128;

// get the maximum amount of quarters
var quarters = parseInt(amount/25);

// get the maximum amount of dimes from leftover
amount = amount % 25;
var dimes = parseInt(amount/10);

// get the maximum amount of nickles from leftover
amount = amount % 10;
var nickles = parseInt(amount/5);

// leftover from nickles is number of pennies (amount should be between 0-4)
var pennies = amount % 5;

// final amounts of each coin
console.log("Quarters: ",quarters, "\n", "Dimes: ",dimes, "\n", "Nickles: ",nickles, "\n", "Pennies: ",pennies)