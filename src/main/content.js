import selfie from "../assets/selfie.jpeg"
import React from 'react';
import './content.css';

export default function Content() {
    return (
        <div className="content">
            <img src={selfie} className="selfie" alt="logo" />
            <h1 className="text-xl">Hello, I am Eirik Hanasand!</h1>
            <h1>A frontend developer specialised in React Native</h1>
        </div>
    )
}