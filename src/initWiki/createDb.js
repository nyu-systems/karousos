

var conn = {
    host: "localhost",
    user: 'root',
    password: '1234',
    database:'wiki'
  };

  var knex = require('knex')({ client: 'mysql2', connection: conn });

(async ()=>{
     try{
      await initComments();
      await initPages();
      knex.destroy();
     }catch(e){
      console.log("something went wrong "+e)
     }
})();

async function initPages(){
  await knex.schema.dropTableIfExists('pages');
  await knex.schema.createTable('pages',function(table){
    table.string('apath').primary()
    table.string('publishStartDate').defaultTo("this date is the default one")
    table.string('publishEndDate').defaultTo("this date is the default one")
    table.string('title').notNullable().defaultTo("this title is the default one")
    table.string('description').notNullable().defaultTo("this description is the default one")
    table.boolean('isPrivate').notNullable().defaultTo(false)
    table.boolean('isPublished').notNullable().defaultTo(true)
    table.text('content').notNullable().defaultTo("some content")
    table.text('render').notNullable().defaultTo("<p>"+"some content"+"<p>")
    table.text('toc').notNullable().defaultTo("[]")
    table.string('contentType').notNullable().defaultTo("html")
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()
    table.string('localeCode').notNullable().defaultTo("en")
    table.text('ionRequestID')
    table.text('ionTxID')
    table.integer('ionTxNum')
  })
  console.log("created the table for page")
}
async function initComments(){
  await knex.schema.dropTableIfExists('comments');
  await knex.schema.createTable('comments', function (table) {
    table.charset('utf8mb4')
    table.increments('id').primary()
    table.text('content').notNullable()
    table.text('render').notNullable()
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()
    table.string('name').notNullable().defaultTo('')
    table.string('email').notNullable().defaultTo('')
    table.string('ip').notNullable().defaultTo('')
    table.integer('replyTo').unsigned().notNullable().defaultTo(0)
    table.integer('pageId').unsigned()
    table.integer('authorId').unsigned()
    table.text('ionRequestID')
    table.text('ionTxID')
    table.integer('ionTxNum')
  })
  console.log("created the comment table")
}



