/* Local browser regression. DC_TEST_COOKIE_FILE contains a local session token.
 * All browser API mutations are intercepted. Server-rendered pages read real data.
 * DC_PLAYWRIGHT_MODULE / DC_CHROMIUM_PATH can reuse an existing browser install. */
const {chromium}=require(process.env.DC_PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const base=process.env.DC_TEST_URL || 'http://127.0.0.1:3097';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local test server');
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.DC_CHROMIUM_PATH?{executablePath:process.env.DC_CHROMIUM_PATH}:{})});
try {
for(const width of [390,1440]) {
 const context=await browser.newContext({viewport:{width,height:900}});
 await context.addCookies([{name:'next-auth.session-token',value:fs.readFileSync(process.env.DC_TEST_COOKIE_FILE,'utf8'),url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 // Default deny for writes, including unrelated endpoints.
 await page.route('**/api/**',r=>['POST','PUT','PATCH','DELETE'].includes(r.request().method())?r.fulfill({status:500,json:{error:'Fallo controlado'}}):r.continue());
 let payload;
 await page.route('**/api/tmdb/search?*',r=>r.fulfill({json:[{imdbID:'100',tmdbId:100,Title:'Película de prueba',Year:'2026',Poster:''}]}));
 await page.route('**/api/tmdb/100',r=>r.fulfill({json:{parsed:{imdbId:'tt99999999',title:'Película de prueba',year:2026,genres:[],directors:[],cast:[]}}}));
 await page.route('**/api/movies',r=> { if(r.request().method()==='POST'){payload=r.request().postDataJSON();return r.fulfill({status:500,json:{error:'Fallo controlado'}});}return r.continue(); });
 await page.goto(base+'/peliculas/nueva');
 await page.getByRole('textbox',{name:'Buscar película',exact:true}).fill('prueba');await page.getByRole('button',{name:'Buscar',exact:true}).click();
 await page.getByRole('button',{name:'Película de prueba 2026'}).click();
 await page.waitForFunction(()=>document.querySelector('input[required][placeholder="Título de la película"]')?.value==='Película de prueba');
 await page.getByRole('spinbutton',{name:'Mi puntuación'}).fill('8.5');
 await page.getByRole('textbox',{name:'Mi crítica',exact:true}).fill('Crítica que debe sobrevivir a la recarga');
 await page.getByRole('button',{name:'Guardar película',exact:true}).click();await page.getByRole('alert').filter({hasText:'Fallo controlado'}).waitFor();
 assert.equal(payload.myRating,8.5);assert.equal(payload.status,'vista');assert.ok(payload.review.includes('sobrevivir'));
 await page.reload();await page.getByRole('button',{name:'Restaurar borrador',exact:true}).click();
 assert.equal(await page.getByRole('spinbutton',{name:'Mi puntuación'}).inputValue(),'8.5');assert.ok((await page.getByRole('textbox',{name:'Mi crítica',exact:true}).innerText()).includes('sobrevivir'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`/tmp/dc-form-${width}.png`,timeout:15000});
 // Read a real record, use its ID only as the simulated successful-save destination.
 const response=await context.request.get(base+'/api/movies?status=vista&limit=100&orderBy=watchedAt');
 const {movies}=await response.json();const movie=movies.find(m=>m.watchedAt);assert.ok(movie);
 await page.route('**/api/movies',r=>r.request().method()==='POST'?r.fulfill({json:{id:movie.id}}):r.continue());
 await page.getByRole('button',{name:'Guardar película',exact:true}).click();await page.waitForURL(`**/peliculas/${movie.id}`);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dc-form:create:new')),null);
 console.log('PASS search, rating, failed save, restore, successful save',width);
 for(const route of ['/peliculas?status=vista&sort=watchedAt','/colecciones','/balance','/balance?mes=1900-01',`/balance?mes=${movie.watchedAt.slice(0,7)}`]){
   await page.goto(base+route);await page.waitForTimeout(500);
   assert.ok(!await page.getByText('Algo ha fallado',{exact:true}).count());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflow');
 }
 assert.ok((await page.locator('body').innerText()).includes(movie.title));
 await page.screenshot({path:`/tmp/dc-balance-${width}.png`,timeout:15000});
 // Existing review editing: refresh, restore, successful-save cleanup.
 await page.goto(`${base}/peliculas/${movie.id}/editar`);
 await page.getByRole('textbox',{name:'Mi crítica',exact:true}).fill('Borrador de edición verificado');
 await page.reload();await page.getByRole('button',{name:'Restaurar borrador',exact:true}).click();assert.ok((await page.getByRole('textbox',{name:'Mi crítica',exact:true}).innerText()).includes('edición verificado'));
 await page.route(`**/api/movies/${movie.id}`,r=>r.request().method()==='PUT'?r.fulfill({json:{id:movie.id}}):r.continue());
 await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.waitForURL(`**/peliculas/${movie.id}`);
 assert.equal(await page.evaluate(id=>localStorage.getItem(`dc-form:edit:${id}`),movie.id),null);
 console.log('PASS existing review recovery and cleanup',width);
 // Collection editing, including failure and refresh.
 await page.goto(base+'/colecciones');await page.getByRole('button',{name:/Añadir comentario|Editar comentario/}).first().click();
 await page.getByRole('textbox',{name:'Tu comentario'}).fill('Comentario de prueba local');await page.getByRole('button',{name:'Guardar comentario',exact:true}).click();await page.getByRole('alert').filter({hasText:'No se ha guardado el comentario'}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Restaurar borrador',exact:true}).first().click();assert.equal(await page.getByRole('textbox',{name:'Tu comentario'}).inputValue(),'Comentario de prueba local');
 await page.route('**/api/collections/*',r=>r.fulfill({json:{ok:true}}));await page.getByRole('button',{name:'Guardar comentario',exact:true}).click();await page.getByText('Comentario de prueba local',{exact:true}).waitFor();
 console.log('PASS collection failure, restore, successful save',width);
 await page.goto(base+'/watchlist');await page.getByRole('button',{name:/Marcar .* como vista/}).first().click();
 await page.getByRole('textbox',{name:'Mi crítica',exact:true}).fill('Visionado pendiente de guardar');await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.getByRole('button',{name:/Marcar .* como vista/}).first().click();await page.getByRole('button',{name:'Restaurar borrador',exact:true}).click();assert.ok((await page.getByRole('textbox',{name:'Mi crítica',exact:true}).innerText()).includes('pendiente de guardar'));
 await page.getByRole('button',{name:'Marcar como Vista',exact:true}).click();await page.getByText('Fallo controlado',{exact:true}).first().waitFor();
 console.log('PASS quick watched dialog recovery and failed save',width);
 assert.deepEqual(errors,[]);await context.close();
}
// An incomplete form and an intentionally emptied review remain recoverable.
const narrow=await browser.newContext({viewport:{width:320,height:740},reducedMotion:'reduce'});
await narrow.addCookies([{name:'next-auth.session-token',value:fs.readFileSync(process.env.DC_TEST_COOKIE_FILE,'utf8'),url:base}]);
const small=await narrow.newPage();small.on('dialog',d=>d.accept());await small.goto(base+'/peliculas/nueva');
await small.getByRole('textbox',{name:'URL del póster'}).waitFor();assert.ok(await small.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await small.getByRole('textbox',{name:'Mi crítica',exact:true}).fill('Texto');await small.getByRole('textbox',{name:'Mi crítica',exact:true}).fill('');
await small.reload();await small.getByRole('button',{name:'Restaurar borrador',exact:true}).click();assert.equal((await small.getByRole('textbox',{name:'Mi crítica',exact:true}).innerText()).trim(),'');
const invalid=await narrow.request.put(base+'/api/collections/0',{data:{description:'invalid id'}});assert.equal(invalid.status(),400);
await narrow.close();console.log('PASS 320px, reduced motion, incomplete draft, empty review, invalid ID');
// Storage unavailable: editing and an intercepted successful save still work.
const context=await browser.newContext({viewport:{width:360,height:800}});
await context.addCookies([{name:'next-auth.session-token',value:fs.readFileSync(process.env.DC_TEST_COOKIE_FILE,'utf8'),url:base,httpOnly:true,sameSite:'Lax'}]);
await context.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('Storage unavailable');};Storage.prototype.removeItem=function(){throw new Error('Storage unavailable');};});
const page=await context.newPage();await page.route('**/api/movies',r=>r.fulfill({status:500,json:{error:'Fallo controlado'}}));
await page.goto(base+'/peliculas/nueva');await page.getByRole('textbox',{name:'Mi crítica',exact:true}).fill('Texto sin almacenamiento');await page.getByText(/No se pudo guardar el borrador/).waitFor();assert.ok((await page.getByRole('textbox',{name:'Mi crítica',exact:true}).innerText()).includes('sin almacenamiento'));await context.close();console.log('PASS storage unavailable warning without editor crash');
} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
