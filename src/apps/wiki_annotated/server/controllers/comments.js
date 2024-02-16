const express = require('express')
const router = express.Router()

router.all('/post', async(req, res) => {
    const args={
      pageId: 1,
      replyTo: 1,
      content: new Date(),
      guestName: '',
      guestEmail: '',
      user: req.user,
      ip: '172.17.0.1',
    }
    karousos.recordAccess(args.pageID, requestID, handlerID, false, true);
    karousos.recordAccess(args.replyTo, requestID, handlerID, false, true);
   //. karousos.recordAccess(args.content, requestID, handlerID, false, true);
    karousos.recordAccess(args.guestEmail, requestID, handlerID, false, true);
    karousos.recordAccess(args.guestName, requestID, handlerID, false, true);
    karousos.recordAccess(args.ips, requestID, handlerID, false, true);
    karousos.recordAccess(args.user, requestID, handlerID, false, true);


    const ret=await WIKI.models.comments.postNewComment(args);
    karousos.recordAccess(ret, requestID, handlerID, false, true);

    res.send(ret+".");
  })



  router.all('/getAll', async(req, res) => {
    const comments = await WIKI.models.comments.transaction(async trx=>
         await WIKI.models.comments.query().orderBy('id')
        )
    karousos.recordAccess(comments, requestID, handlerID, false, true);

    res.send(
        comments.map(c => ({
            ...c
      })))

  })

module.exports = router
