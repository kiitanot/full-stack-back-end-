const { MongoClient } = require('mongodb');

// MongoDB connection details
const uri = 'mongodb+srv://ko460:nCEsXelqNFBfvPGQ@webstorecluster.wu59k.mongodb.net/?retryWrites=true&w=majority&appName=WebstoreCluster';
const dbName = 'Webstore';

async function seedData() {
  const client = new MongoClient(uri);

  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    // Access the database and collection
    const db = client.db(dbName);
    const productsCollection = db.collection('products');

    // Sample data to insert
    const sampleData = [
      {
        "title": "Math Lesson",
        "description": "A comprehensive math class for all levels.",
        "price": 50,
        "availableInventory": 10,
        "location": "London"
      },
      {
        "title": "Science Lesson",
        "description": "Explore the wonders of science in this engaging class.",
        "price": 60,
        "availableInventory": 5,
        "location": "Manchester"
      },
      {
        "title": "History Lesson",
        "description": "Dive into history with this captivating class.",
        "price": 40,
        "availableInventory": 8,
        "location": "Birmingham"
      }
    ];

    // Insert data into the collection
    const result = await productsCollection.insertMany(sampleData);
    console.log(`${result.insertedCount} products inserted.`);
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    // Close the database connection
    await client.close();
    console.log('Database connection closed');
  }
}

// Call the seedData function
seedData();
