const http=require('node:http'),fs=require('node:fs');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>开物研究数据库迁移</title><h1>深度研究：新增表和服务端权限</h1><textarea aria-label="研究迁移SQL" style="width:95vw;height:80vh">'+escape(fs.readFileSync('supabase/migrations/20261004_deep_research.sql','utf8'))+'</textarea>');}).listen(8766,'127.0.0.1',()=>console.log('Research SQL source ready on 127.0.0.1:8766'));
