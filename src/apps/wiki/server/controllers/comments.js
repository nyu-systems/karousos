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
    const ret=await WIKI.models.comments.postNewComment(args);
    res.send(ret+".");
  })


  
  router.all('/getAll', async(req, res) => {
    const comments = await WIKI.models.comments.transaction(async trx=>
         await WIKI.models.comments.query().orderBy('id')
        )
    res.send(
        comments.map(c => ({
            ...c
      })))

  })

module.exports = router
