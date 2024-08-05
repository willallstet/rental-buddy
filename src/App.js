import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { OpenAI } from 'openai';
import './App.css';
import LoadingOverlay from './LoadingOverlay';

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

function App() {
  const [squares, setSquares] = useState([]);
  const [listings, setListings] = useState([]);
  const [orderedListings, setOrderedListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await axios.get('/sampleListings.json');
        setListings(response.data);
      } catch (error) {
        console.error('Error fetching listings:', error);
      }
    };

    fetchListings();
  }, []);

  useEffect(() => {
    const fetchOrderedListings = async () => {
      setIsLoading(true);
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const remainingListings = listings.filter(listing =>
        !squares.some(square => square.listing.url === listing.url)
      );

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Order the following homes from best to worst based on the likability and likelihood of the other homes. If a home is more similar to a home with a high likelyhood and likability, rank it higher. ONLY INCLUDE A LIST OF ADDRESSES SEPARATED BY A SEMICOLON, NOTHING ELSE:'
            },
            {
              role: 'user',
              content: remainingListings.map(listing => `Address: ${listing.address}, Likability: ${listing.likability}, Apply Likelihood: ${listing.applyLikelihood}`).join('\n') + '. If none have likability ratings, order them in the same order.'
            }
          ],
          max_tokens: 200,
        });

        if (response.choices && response.choices.length > 0 && response.choices[0].message && response.choices[0].message.content) {
          let orderedAddresses = response.choices[0].message.content.split(';').map(address => address.trim()).filter(address => address !== '')
          orderedAddresses = orderedAddresses.map(address => address.replace(/\./g, ''));
          console.log(orderedAddresses);
          const orderedListings = orderedAddresses.map(address => remainingListings.find(listing => listing.address === address));
          setOrderedListings(orderedListings);
        } else {
          console.error('Unexpected response format:', response);
        }
      } catch (error) {
        console.error('Error parsing response:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (squares.length > 0) {
      fetchOrderedListings();
    } else {
      setOrderedListings(listings);
    }
  }, [listings, squares]);

  useEffect(() => {
    squares.forEach(square => {
      //console.log(`Listing: ${square.listing.address}, Likability: ${square.listing.likability}, Apply Likelihood: ${square.listing.applyLikelihood}`);
    });
  }, [squares]);

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('id', id);
  };

  const handleThumbnailDragStart = (e, listing) => {
    e.dataTransfer.setData('listing', JSON.stringify(listing));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('id');
    const listingData = e.dataTransfer.getData('listing');

    if (id) {
      const square = squares.find(s => s.id === parseInt(id));
      const plotRect = e.currentTarget.getBoundingClientRect();
      const newTop = e.clientY - plotRect.top - 25;
      const newLeft = e.clientX - plotRect.left - 25;

      const newSquares = squares.map(s => {
        if (s.id === square.id) {
          return { ...s, top: newTop, left: newLeft, listing: { ...s.listing, likability: newLeft, applyLikelihood: plotRect.height - newTop } };
        }
        return s;
      });

      setSquares(newSquares);
    } else if (listingData) {
      const listing = JSON.parse(listingData);

      // Check if the listing already exists in the squares
      const exists = squares.some(square => square.listing && square.listing.url === listing.url);
      if (exists) {
        return; // Do not add the listing if it already exists
      }

      const plotRect = e.currentTarget.getBoundingClientRect();
      const newTop = e.clientY - plotRect.top - 25;
      const newLeft = e.clientX - plotRect.left - 25;

      const newSquare = {
        id: squares.length + 1,
        top: newTop,
        left: newLeft,
        imageUrl: listing.image_url,
        listing: { ...listing, likability: newLeft, applyLikelihood: plotRect.height - newTop }, // Add new fields
      };

      setSquares([...squares, newSquare]);
      setListings(listings.filter(l => l.url !== listing.url)); // Remove the listing from the grid
    }
  };

  const handleThumbnailClick = (listing) => {
    setSelectedListing(listing);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedListing(null);
  };

  const handleRemoveSquare = (e, id) => {
    e.stopPropagation();
    const square = squares.find(s => s.id === id);
    setSquares(squares.filter(s => s.id !== id));
    setListings([...listings, square.listing]);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="top-bar">
          <img src="/logo.png" alt="Rental Buddy" className="logo" />
          <h1 className="title">Rental Buddy</h1>
        </div>
        <div className="content">
          <div className="plot" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
            {squares.map(square => (
              <div
                key={square.id}
                className="square"
                draggable="true"
                onDragStart={(e) => handleDragStart(e, square.id)}
                onClick={() => handleThumbnailClick(square.listing)}
                style={{
                  width: '100px',
                  height: '100px',
                  backgroundColor: '#001d4a',
                  position: 'absolute',
                  top: square.top,
                  left: square.left,
                  backgroundImage: square.imageUrl ? `url(${square.imageUrl})` : 'none',
                  backgroundSize: 'cover',
                  cursor: 'pointer',
                }}
              >
                <span className="close-square" onClick={(e) => handleRemoveSquare(e, square.id)}>&times;</span>
              </div>
            ))}
            <div className="x-axis-label">Will</div>
            <div className="y-axis-label">Sam</div>
          </div>
          <div className="listings-grid">
            {orderedListings.length > 0 ? (
              orderedListings.map((listing, index) => (
                <div
                  key={index}
                  className="thumbnail"
                  draggable="true"
                  onDragStart={(e) => handleThumbnailDragStart(e, listing)}
                  onClick={() => handleThumbnailClick(listing)}
                >
                  {listing.image_url && <img src={listing.image_url} alt={listing.description} />}
                  <div className="caption">{listing.address}</div>
                </div>
              ))
            ) : (
              <p>No listings available</p>
            )}
          </div>
        </div>
        <br />
      </header>
      {isModalOpen && selectedListing && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={closeModal}>&times;</span>
            <h2>
              <a href={selectedListing.url} target="_blank" rel="noopener noreferrer">
                {selectedListing.address}
              </a><br />
              {selectedListing.bedrooms} beds, {selectedListing.bathrooms} baths, ${selectedListing.price} a month in {selectedListing.neighborhood}
            </h2>
            {selectedListing.image_url && <img src={selectedListing.image_url} alt={selectedListing.description} />}
            <p dangerouslySetInnerHTML={{ __html: selectedListing.description.replace(/\n/g, '<br>') }}></p>
          </div>
        </div>
      )}
      {isLoading && <LoadingOverlay />}
    </div>
  );
}

export default App;