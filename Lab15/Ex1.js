const fs = require('fs');
var express = require('express');
const { response } = require('express');
var app = express();

var cookieParser = require('cookie-parser');
app.use(cookieParser());

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

app.get('/set_cookie', function (request,response) {
// this will send a cookie to the requester
// cookie is data that is sent in response to a request 
// cookie can only be sent in a response
response.cookie('name', 'Nicole');
response.send('The name cookie has been sent!')
});

app.get('/use_cookie', function (request,response){
// this will get the name cookie from the requester and respond with a message
console.log(request.cookies);
response.send(`Welcome the the Use Cookie page ${request.cookies["name"]}`)
});

app.get("/", function (request, response) {
    response.send("Nothing here!");
});

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

app.listen(8080, () => console.log(`listening on port 8080`));
