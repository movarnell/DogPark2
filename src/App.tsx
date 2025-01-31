import { useEffect, useState } from "react";
import "./App.css";
import { Routes, Route } from "react-router-dom";
import Parks from "./components/Parks";
import SignInForm from "./components/SignInForm";
import Navigation from "./components/Navigation";
import ManageDogs from "./components/ManageDogs";
import Home from "./components/Home";
import { HumanType } from "./types/HumanType";
import RegistrationForm from "./components/RegistrationForm";

function App() {
  const PARKS_ENDPOINT = "https://backend.michaelvarnell.com:4050/api/parks/";
  const [parks, setParks] = useState([]);
  const [signedInUser, setSignedInUser] = useState<HumanType>(() => {
    const cookie = document.cookie.split('; ').find(row => row.startsWith('user='));
    return cookie ? JSON.parse(decodeURIComponent(cookie.split('=')[1])) : null;
  });

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
    <Navigation signedInUser={signedInUser} />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<SignInForm setSignedInUser={setSignedInUser} />} />
      <Route path="/register" element={<RegistrationForm />} />
      <Route path="/ManageDogs" element={<ManageDogs signedInUser={signedInUser} />} />
      <Route path="/parks" element={<Parks parks={parks} />}/>
    </Routes>
    </>
  );
}

export default App;
