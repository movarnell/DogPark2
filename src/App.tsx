import { useEffect, useState } from "react";
import "./App.css";
import ParkCards from "./components/ParkCard";

function App() {
  const PARKS_ENDPOINT = "https://backend.michaelvarnell.com:4050/api/parks/";
  const [parks, setParks] = useState([]);

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
      <h1>Dog Parks</h1>
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {parks.map((park, index) => (
            <ParkCards key={index} park={park} index={index} />
          ))}
        </div>
      </div>
    </>
  );
}

export default App;
