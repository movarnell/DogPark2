import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { HumanType } from '../types/HumanType';

type DogType = {
  id: number;
  ownerId: number;
  dog_name: string;
  isFriendly: boolean;
  isPuppy: boolean;
  size: string;
};

function ManageDogs({ signedInUser }: { signedInUser: HumanType }) {
  const [dogs, setDogs] = useState<DogType[]>([]);
  const [dogName, setDogName] = useState('');
  const [isFriendly, setIsFriendly] = useState(false);
  const [isPuppy, setIsPuppy] = useState(false);
  const [dogSize, setDogSize] = useState('');

  useEffect(() => {
    async function fetchDogs() {
      try {
        const res = await fetch('https://backend.michaelvarnell.com:4050/api/dogs', {
          credentials: 'include'
        });
        const data = await res.json();
        // sort to show only owners dogs
        data.sort((a: DogType, b: DogType) => a.id - b.id);
        let ownersDogs = data.filter((d: DogType) => d.ownerId === signedInUser.id);
        setDogs(ownersDogs);
      } catch {
        toast.error('Failed to fetch dogs');
      }
    }
    fetchDogs();
  }, []);

  async function handleAddDog(e: any) {
    e.preventDefault();
    try {
      const res = await fetch('https://backend.michaelvarnell.com:4050/api/dogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dog_name: dogName,
          isFriendly,
          isPuppy,
          size: dogSize,
          ownerId: signedInUser.id
        }),
      });
      const newDog = await res.json();
      setDogs([...dogs, newDog]);
      setDogName('');
      setIsFriendly(false);
      setIsPuppy(false);
      setDogSize('');
      toast.success('Dog added successfully');
    } catch {
      toast.error('Failed to add dog');
    }
  }

  //SECTION - Remove Dog
  async function handleRemoveDog(id: number) {
    try {
      const res = await fetch(`https://backend.michaelvarnell.com:4050/api/dogs/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Dog removed');
        setDogs(dogs.filter(d => d.id !== id));
      } else {
        toast.error('Error removing dog');
      }
    } catch {
      toast.error('Server error');
    }
  }
  //SECTION Remove Dog END

  return (
    <div className="container mx-auto my-8">
      <h1 className="mb-4 text-2xl font-bold">Manage Dogs</h1>
      <ul>
        {dogs.map(dog => (
          <li key={dog.id} className="flex items-center justify-between mb-2">
            <span>{dog.dog_name}</span>
            <button
              className="px-2 py-1 text-white bg-red-600 rounded"
              onClick={() => handleRemoveDog(dog.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAddDog} className="flex flex-col p-4 mt-4 bg-gray-100 rounded">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <input
            value={dogName}
            onChange={e => setDogName(e.target.value)}
            type="text"
            placeholder="New Dog Name"
            className="p-2 border rounded"
          />
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={isFriendly}
              onChange={e => setIsFriendly(e.target.checked)}
            />
            <span>Friendly?</span>
          </label>
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={isPuppy}
              onChange={e => setIsPuppy(e.target.checked)}
            />
            <span>Puppy?</span>
          </label>
          <label className="flex items-center space-x-1">
            <select
              value={dogSize}
              onChange={e => setDogSize(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="">Select size</option>
              <option value="small">Small (0-20lbs)</option>
              <option value="medium">Medium (20-40lbs)</option>
              <option value="large">Large (40+ lbs)</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 text-white bg-blue-600 rounded"
        >
          Add Dog
        </button>
      </form>
    </div>
  );
}

export default ManageDogs;
