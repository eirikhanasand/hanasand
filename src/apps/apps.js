import React from "react"
import Login from "../assets/iphone-events.png"
import './apps.css';

export default function Apps() {
    return (
        <div className="outline">
            <div className="left_div">
                <p className="browse">Follow up on activities, even when offline</p>
            </div>
            <div className="right_div">
                <img
                    width={450} 
                    src={Login}
                    alt="Logo" 
                />
            </div>
        </div>
    )
}