import './content.css';

export default function Content() {
    return (
        <div className="content">
            <img src={require("../assets/selfie.jpeg")} className="selfie" alt="logo" />
            <h1 className="name">Hello, I am Eirik Hanasand!</h1>
            <h1>A frontend developer specialised in React Native</h1>
        </div>
    )
}