import Featured from './featured/featured';
import Content from './main/content';
import Contact from './main/contact';
import Apps from './apps/apps';
import Nav from './nav/nav';
import React from 'react';

function App() {
  return (
    <div className="App">
      <header>
        <Nav />
      </header>
      <div>
        <Content />
        <Apps />
        <Featured />
      </div>
      <footer>
        <Contact />
      </footer>
    </div>
  );
}

export default App;
