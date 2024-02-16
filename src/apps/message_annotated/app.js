const express = require('express');
// const bodyParser = require('body-parser');

/* App variables */
const app = express();
const port = '8000';

var data = new Map();
data = karousos.recordAccess(data, requestID, handlerID, false, true);

//get the message of a specified date
function getMessage(date, forToday) {
  let ret = data.get(date);
  if (!ret || (!ret.readable && !forToday)){
   return ""
  }else{
   return ret.message
  }
}

//insert message of a specified date
function postMessage(date, message, readable) { 
 if (typeof(message) == 'undefined') {
	 message = null;
  }
  data.set(date, {'message': message, 'readable': readable});
}

app.all('/getdate', function (req, res) {
  //search for the message of a date
  let body = '';
  req.on('data', (chunk) => {body += chunk;});
  req.on('end', () => {
    let reqBody = JSON.parse(body);
    let today = (new Date()).toISOString().substring(0, 10);
    let ret = getMessage(reqBody.date, reqBody.date == today)
    if (ret) {
      res.send(reqBody.date + ': ' + ret);
    } else {
      res.send("No message for " + reqBody.date);
    }
  });
});

app.post('/post', function (req, res) {
  //post a message of a date
  let body = '';
  req.on('data', (chunk) => {body += chunk;});
  req.on('end', () => {
    let reqBody = JSON.parse(body);
    try{
    postMessage(reqBody.date, reqBody.message, reqBody.readable)
    }catch(err){
    	res.send(err)
    }
    res.send('Posted: ' + reqBody.date + ': ' + reqBody.message);
  });
});


app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`);
});
