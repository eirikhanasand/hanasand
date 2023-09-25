import Nav from './nav/nav';
import './App.css';
import Featured from './featured/featured';
import Content from './main/content';
import Contact from './main/contact';

function App() {
  return (
    <div className="App">
      <header>
        <Nav />
      </header>
      <div>
        <Content />
        <Featured />
      </div>
      <footer>
        <Contact />
      </footer>
    </div>
  );
}

export default App;
