// uses cors to allow cross-origin requests
const { queryCodebase } = require('./prompt');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());


app.use('/pages', express.static(path.join(__dirname, 'pages')));

app.use(express.static(path.join(__dirname, 'pages')));
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static('public'));

app.get('/', (req, res) => { res.sendFile(__dirname + '/views/index.html') });
app.get('/index.js', (req, res) => { res.sendFile(__dirname + '/views/index.js') });
app.get('/index.css', (req, res) => { res.sendFile(__dirname + '/views/index.css') });
app.get('/api', (req, res) => {
    const command = req.body.command;
    const result = act(command);
    res.json({ result });
});

// listen for requests
const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port);
});

// act on a command
async function act(command) {
    command = command.trim();
    return queryCodebase(command);
}
