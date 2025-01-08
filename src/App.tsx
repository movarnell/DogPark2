import { useEffect, useState } from "react";
import "./App.css";
import { Routes, Route } from "react-router-dom";
import Parks from "./components/Parks";
import SignInForm from "./components/SignInForm";
import Navigation from "./components/Navigation";
import Home from "./components/Home";
import { HumanType } from "./types/HumanType";

function App() {
  const PARKS_ENDPOINT = "https://backend.michaelvarnell.com:4050/api/parks/";
  const [parks, setParks] = useState([]);
  const [signedInUser, setSignedInUser] = useState<HumanType | null>(null);

  useEffect(() => {
    getParks();
  }, []);

  const getParks = async () => {
    try {
      const response = await fetch(PARKS_ENDPOINT);
      const data = await response.json();
      setParks(data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
    <Navigation />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<SignInForm signedInUser={signedInUser} setSignedInUser={setSignedInUser} />} />
      <Route path="/parks" element={<Parks parks={parks} />}/>
    </Routes>
    </>
  );
}

export default App;
