const express = require('express')
const router = express.Router()


router.all('/create', async(req, res) => {
  //let reqBody = JSON.parse(data);
  let publishStartDate = (new Date()).toISOString();
  karousos.recordAccess(publishStartDate, requestID, handlerID, false, true);

  let publishEndDate = (new Date()).toISOString();
  karousos.recordAccess(publishEndDate, requestID, handlerID, false, true);

    let opts={
        content: req.content||"default content",
        description: req.discription||"default discription",
        isPrivate: false,
        isPublished: true,
        locale: "en",
        path:req.pagePath||("home"+(Math.floor)((Math.random()*1000000)%10000)),
        title: req.title||"default title",
        publishStartDate,
        publishEndDate
    }
    //karousos.recordAccess(opts, requestID, handlerID, false, true);

    res.send( await WIKI.models.pages.createPage(opts));
  })



  router.all('/getAll', async(req, res) => {
    res.send(await WIKI.models.knex.transaction(trx=>
        trx('pages').select("*")))
  })



module.exports = router
