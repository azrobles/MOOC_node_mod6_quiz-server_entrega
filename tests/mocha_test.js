const path = require("path");
const fs = require('fs-extra');
const { spawn } = require('child_process');
const Utils = require("./testutils");
const Browser = require("zombie");
const chai = require('chai');
const chaiHttp = require('chai-http');
const should = chai.should();


const T_TEST = 2 * 60; // Time between tests (seconds)
const path_assignment = path.resolve(path.join(__dirname, "../"));
const path_file = path.join(path_assignment, "main.js");
const T_WAIT = 2; // Time between commands
const timeout = ms => new Promise(res => setTimeout(res, ms));
const BASE_URL = "http://localhost:8000";

let server = null;

chai.use(chaiHttp);

before("Lanzando el servidor", async function () {
  this.timeout(T_TEST * 1000);

  // move original db file
  const path_db = path.join(path_assignment, 'db.sqlite');
  const dbexists = await Utils.checkFileExists(path_db);
  if (dbexists) {
    try {
      fs.moveSync(path_db, path_db+".bak", { overwrite: true });
    } catch (e) { console.error(e); }
  }

  // launch server
  server = spawn("node", [path_file], {cwd: path_assignment});
  let error_launch = "";
  server.on('error', function (data) {
    error_launch += data;
  });
  server.stderr.on('data', function (data) {
    error_launch += data;
  });
  await Utils.to(timeout(T_WAIT*1000));
  if (error_launch.length) {
    console.log(`Error al lanzar '${path_file}'<<\n\t\t\tRecibido: ${error_launch}`);
  }
  console.log(`'${path_file}' se ha lanzado correctamente`);
});
after("Cerrando servidor", async function () {
  this.timeout(T_TEST * 1000);

  // kill server
  if (server) {
    server.kill();
    await Utils.to(timeout(T_WAIT*1000));
  }

  // restore original db file
  const path_db = path.join(path_assignment, 'db.sqlite');
  const [, exists] = await Utils.to(fs.pathExists(path_db+".bak"));
  if (exists) {
    fs.moveSync(path_db+".bak", path_db, { overwrite: true })
  } else {
    fs.removeSync(path_db);
  }
});

// Test que comprueba la funcionalidad de una vista mostrada al usuario.
describe("User visits the quizzes index page.", function () {
  const browser = new Browser();
  
  before(() => browser.visit(BASE_URL + "/quizzes"));
  
  it("Should be successful.", function () {
    browser.assert.success();
  });

  it("Should see the quizzes index page.", function () {
    browser.assert.url({pathname: "/quizzes"});
    browser.assert.text('h1', 'Quizzes');
    browser.assert.elements('tr', 4);
  });
});

// Test que comprueba el funcionamiento de un formulario.
describe("User tries to create a new quizz.", function () {
  const browser = new Browser();
  
  before(() => browser.visit(BASE_URL + "/quizzes/new"));
  
  it("Should be successful.", function () {
    browser.assert.success();
  });

  it("Should see the page with the form to create a new quiz.", function () {
    browser.assert.url({pathname: "/quizzes/new"});
    browser.assert.text('h1', 'Create New Quiz');
  });

  describe("Submit the create new quiz form.", function () {
    before(function () {
      browser.fill("question", "Testing question");
      browser.fill("answer", "Testing answer");
      return browser.pressButton("Create");
    });

    it("Should be successful.", function () {
      browser.assert.success();
    });

    it("Should see the index page with the created quiz.", function () {
      browser.assert.url({pathname: "/quizzes"});
      browser.assert.elements('tr', 5);
      browser.assert.text("tr:last-child td:first-child", "Testing question");
    });
  });
});

// Test que comprueba el funcionamiento de una ruta.
describe("GET /quizzes/:id/edit", function () {
  it("Should get an existing quiz record for editing.", function (done) {
    chai.request(BASE_URL).get('/quizzes/1/edit').end((err, res) => {
      res.should.have.status(200);
      res.text.should.have.string('/quizzes/1?_method=PUT');
      done();
    });
  });
});

// Test que comprueba el funcionamiento de un controlador.
describe("updateController", function () {
  it("Should update quiz record.", function (done) {
    chai.request(BASE_URL).put('/quizzes/1')
    .set('content-type', 'application/x-www-form-urlencoded')
    .send({
      'question': 'Uganda',
      'answer': 'Kampala'
    }).end((err, res) => {
      res.should.have.status(200);
      res.should.redirectTo(BASE_URL + '/quizzes');
      res.text.should.have.string('Uganda');
      done();
    });
  });

  it("Should not update quiz record if answer is null.", function (done) {
    chai.request(BASE_URL).put('/quizzes/1')
    .set('content-type', 'application/x-www-form-urlencoded')
    .send({
      'question': 'China'
    }).end((err, res) => {
      res.should.have.status(200);
      res.should.redirectTo(BASE_URL + '/');
      res.text.should.not.have.string('China');
      done();
    });
  });
});

// Test que comprueba el funcionamiento de un acceso a la BD.
describe("Quiz.destroy", function () {
  it("Should delete quiz record.", function (done) {
    chai.request(BASE_URL).delete('/quizzes/2').end((err, res) => {
      res.should.have.status(200);
      res.should.redirectTo(BASE_URL + '/quizzes');
      res.text.should.not.have.string('<a href="/quizzes/2/play">');
      done();
    });
  });
});