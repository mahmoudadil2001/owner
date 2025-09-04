
const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where } = require('firebase/firestore');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5pkNdm8ik_Fd2p13QElfVXWMZjJxqKBk",
  authDomain: "owner-523c8.firebaseapp.com",
  projectId: "owner-523c8",
  storageBucket: "owner-523c8.firebasestorage.app",
  messagingSenderId: "414224069376",
  appId: "1:414224069376:web:6030d9f7b6b4a61e3a39e5",
  measurementId: "G-5VBY5ZM24S"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Sign up function
app.post('/signup', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    
    // Check if display name already exists (if provided)
    if (displayName && displayName.trim()) {
      const usersCollection = collection(db, 'users');
      const displayNameQuery = query(usersCollection, where('displayName', '==', displayName.trim()));
      const displayNameSnapshot = await getDocs(displayNameQuery);
      
      if (!displayNameSnapshot.empty) {
        return res.status(400).json({
          success: false,
          message: 'Display name already exists. Please choose a different one.'
        });
      }
    }
    
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Store additional user data in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName ? displayName.trim() : '',
      points: 1,
      pin: null,
      createdAt: new Date().toISOString()
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        uid: user.uid,
        email: user.email,
        displayName: displayName ? displayName.trim() : ''
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// User login function (display name only)
app.post('/user-login', async (req, res) => {
  try {
    const { displayName } = req.body;
    
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Display name is required'
      });
    }
    
    // Find user by display name
    const usersCollection = collection(db, 'users');
    const displayNameQuery = query(usersCollection, where('displayName', '==', displayName.trim()));
    const displayNameSnapshot = await getDocs(displayNameQuery);
    
    if (displayNameSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'User with this display name not found'
      });
    }
    
    // Get the user document
    const userDoc = displayNameSnapshot.docs[0];
    const userData = userDoc.data();
    
    // Don't allow admin to login via display name
    if (userData.email === 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Admin must use email and password login'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        points: userData.points || 0,
        lastLogin: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin login function (email and password)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Sign in user with email and password
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        uid: user.uid,
        email: user.email,
        displayName: userData.displayName || '',
        lastLogin: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Logout function
app.post('/logout', async (req, res) => {
  try {
    await signOut(auth);
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get user profile
app.get('/profile/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const userDoc = await getDoc(doc(db, 'users', uid));
    
    if (userDoc.exists()) {
      res.status(200).json({
        success: true,
        user: userDoc.data()
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Update user profile
app.put('/profile/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { displayName } = req.body;
    
    await setDoc(doc(db, 'users', uid), {
      displayName: displayName,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin route to create new users
app.post('/admin/create-user', async (req, res) => {
  try {
    const { adminEmail, email, password, displayName } = req.body;
    
    // Check if the requesting user is admin
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    // Check if display name already exists (if provided)
    if (displayName && displayName.trim()) {
      const usersCollection = collection(db, 'users');
      const displayNameQuery = query(usersCollection, where('displayName', '==', displayName.trim()));
      const displayNameSnapshot = await getDocs(displayNameQuery);
      
      if (!displayNameSnapshot.empty) {
        return res.status(400).json({
          success: false,
          message: 'Display name already exists. Please choose a different one.'
        });
      }
    }
    
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Store additional user data in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName ? displayName.trim() : '',
      points: 1,
      pin: null,
      createdAt: new Date().toISOString(),
      createdBy: adminEmail
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        uid: user.uid,
        email: user.email,
        displayName: displayName ? displayName.trim() : ''
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin route to get all users
app.get('/admin/users', async (req, res) => {
  try {
    const { adminEmail } = req.query;
    
    // Check if the requesting user is admin
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    // Import additional Firestore functions
    const { collection, getDocs } = require('firebase/firestore');
    
    // Get all users from Firestore
    const usersCollection = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollection);
    
    const users = [];
    usersSnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.status(200).json({
      success: true,
      users: users,
      totalUsers: users.length
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin route to update user points
app.put('/admin/update-points', async (req, res) => {
  try {
    const { adminEmail, userId, points } = req.body;
    
    // Check if the requesting user is admin
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    // Update user points in Firestore
    await setDoc(doc(db, 'users', userId), {
      points: parseInt(points),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    res.status(200).json({
      success: true,
      message: 'Points updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin route to update user points by display name
app.put('/admin/update-points-by-name', async (req, res) => {
  try {
    const { adminEmail, displayName, points } = req.body;
    
    // Check if the requesting user is admin
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    // Find user by display name
    const usersCollection = collection(db, 'users');
    const displayNameQuery = query(usersCollection, where('displayName', '==', displayName.trim()));
    const displayNameSnapshot = await getDocs(displayNameQuery);
    
    if (displayNameSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'User with this display name not found.'
      });
    }
    
    // Get the first (should be only) user with this display name
    const userDoc = displayNameSnapshot.docs[0];
    const userId = userDoc.id;
    
    // Update user points in Firestore
    await setDoc(doc(db, 'users', userId), {
      points: parseInt(points),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    res.status(200).json({
      success: true,
      message: 'Points updated successfully',
      userEmail: userDoc.data().email
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin route to update display name by current display name
app.put('/admin/update-display-name-by-name', async (req, res) => {
  try {
    const { adminEmail, currentDisplayName, newDisplayName } = req.body;
    
    // Check if the requesting user is admin
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    // Check if new display name already exists (unless it's the same user)
    if (newDisplayName && newDisplayName.trim()) {
      const usersCollection = collection(db, 'users');
      const newDisplayNameQuery = query(usersCollection, where('displayName', '==', newDisplayName.trim()));
      const newDisplayNameSnapshot = await getDocs(newDisplayNameQuery);
      
      if (!newDisplayNameSnapshot.empty) {
        const existingUser = newDisplayNameSnapshot.docs[0].data();
        if (existingUser.displayName !== currentDisplayName) {
          return res.status(400).json({
            success: false,
            message: 'New display name already exists. Please choose a different one.'
          });
        }
      }
    }
    
    // Find user by current display name
    const usersCollection = collection(db, 'users');
    const displayNameQuery = query(usersCollection, where('displayName', '==', currentDisplayName.trim()));
    const displayNameSnapshot = await getDocs(displayNameQuery);
    
    if (displayNameSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'User with this display name not found.'
      });
    }
    
    // Get the user document
    const userDoc = displayNameSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    // Update display name in Firestore
    await setDoc(doc(db, 'users', userId), {
      displayName: newDisplayName ? newDisplayName.trim() : '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    res.status(200).json({
      success: true,
      message: 'Display name updated successfully',
      userEmail: userData.email,
      oldDisplayName: currentDisplayName,
      newDisplayName: newDisplayName
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin route to delete user by display name
app.delete('/admin/delete-user-by-name', async (req, res) => {
  try {
    const { adminEmail, targetDisplayName } = req.body;
    
    // Check if the requesting user is admin
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    // Find user by display name
    const usersCollection = collection(db, 'users');
    const displayNameQuery = query(usersCollection, where('displayName', '==', targetDisplayName.trim()));
    const displayNameSnapshot = await getDocs(displayNameQuery);
    
    if (displayNameSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'User with this display name not found.'
      });
    }
    
    // Get the user document
    const userDoc = displayNameSnapshot.docs[0];
    const userData = userDoc.data();
    
    // Prevent admin from deleting themselves
    if (userData.email === adminEmail) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account.'
      });
    }
    
    // Delete the user document
    const { deleteDoc } = require('firebase/firestore');
    await deleteDoc(doc(db, 'users', userDoc.id));
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      deletedUser: userData.email
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin route to clear old chat messages
app.post('/admin/clear-chat', async (req, res) => {
  try {
    const { adminEmail } = req.body;
    
    // Check if the requesting user is admin
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    // Get all chat messages older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const chatMessagesCollection = collection(db, 'chatMessages');
    const oldMessagesQuery = query(chatMessagesCollection, where('createdAt', '<', sevenDaysAgo.toISOString()));
    const oldMessagesSnapshot = await getDocs(oldMessagesQuery);
    
    let deletedCount = 0;
    const deletePromises = [];
    
    oldMessagesSnapshot.forEach((doc) => {
      deletePromises.push(deleteDoc(doc.ref));
      deletedCount++;
    });
    
    await Promise.all(deletePromises);
    
    res.status(200).json({
      success: true,
      message: `Deleted ${deletedCount} old chat messages`,
      deletedCount: deletedCount
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Buy temporary rank
app.post('/buy-temp-rank', async (req, res) => {
  try {
    const { userId, rankName, price } = req.body;
    
    if (!userId || !rankName || !price) {
      return res.status(400).json({
        success: false,
        message: 'User ID, rank name, and price are required'
      });
    }
    
    // Get user data
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const userData = userDoc.data();
    const currentPoints = userData.points || 0;
    
    if (currentPoints < price) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient points'
      });
    }
    
    // Check if user already has a temp rank
    const tempRankDoc = await getDoc(doc(db, 'tempRanks', userId));
    if (tempRankDoc.exists()) {
      const tempRankData = tempRankDoc.data();
      const now = new Date();
      const expiry = tempRankData.expiresAt.toDate();
      
      if (now < expiry) {
        return res.status(400).json({
          success: false,
          message: 'User already has an active temporary rank'
        });
      }
    }
    
    // Deduct points
    const newPoints = currentPoints - price;
    await setDoc(doc(db, 'users', userId), {
      points: newPoints,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    // Add temporary rank
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 24);
    
    await setDoc(doc(db, 'tempRanks', userId), {
      userId: userId,
      rankName: rankName,
      purchasedAt: new Date().toISOString(),
      expiresAt: expiryDate,
      price: price
    });
    
    res.status(200).json({
      success: true,
      message: `Successfully purchased ${rankName} rank for 24 hours`,
      newPoints: newPoints,
      expiresAt: expiryDate.toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get user temporary rank
app.get('/get-temp-rank/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const tempRankDoc = await getDoc(doc(db, 'tempRanks', userId));
    if (!tempRankDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'No temporary rank found'
      });
    }
    
    const tempRankData = tempRankDoc.data();
    const now = new Date();
    const expiry = new Date(tempRankData.expiresAt);
    
    if (now >= expiry) {
      // Remove expired temp rank
      await deleteDoc(doc(db, 'tempRanks', userId));
      return res.status(404).json({
        success: false,
        message: 'Temporary rank has expired'
      });
    }
    
    res.status(200).json({
      success: true,
      tempRank: tempRankData
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Cleanup expired temporary ranks (scheduled task)
app.post('/cleanup-expired-temp-ranks', async (req, res) => {
  try {
    const { adminEmail } = req.body;
    
    // Check if the requesting user is admin
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    const now = new Date();
    const tempRanksCollection = collection(db, 'tempRanks');
    const tempRanksSnapshot = await getDocs(tempRanksCollection);
    
    let cleanedCount = 0;
    const deletePromises = [];
    
    tempRanksSnapshot.forEach((doc) => {
      const data = doc.data();
      const expiry = new Date(data.expiresAt);
      
      if (now >= expiry) {
        deletePromises.push(deleteDoc(doc.ref));
        cleanedCount++;
      }
    });
    
    await Promise.all(deletePromises);
    
    res.status(200).json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired temporary ranks`,
      cleanedCount: cleanedCount
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get all active temporary ranks (admin only)
app.get('/admin/active-temp-ranks', async (req, res) => {
  try {
    const { adminEmail } = req.query;
    
    // Check if the requesting user is admin
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    const tempRanksCollection = collection(db, 'tempRanks');
    const tempRanksSnapshot = await getDocs(tempRanksCollection);
    
    const activeRanks = [];
    const now = new Date();
    
    for (const doc of tempRanksSnapshot.docs) {
      const data = doc.data();
      const expiry = new Date(data.expiresAt);
      
      if (now < expiry) {
        // Get user display name
        const userDoc = await getDoc(doc(db, 'users', data.userId));
        const userData = userDoc.exists() ? userDoc.data() : {};
        
        activeRanks.push({
          id: doc.id,
          ...data,
          userDisplayName: userData.displayName || 'Unknown',
          timeRemaining: expiry.getTime() - now.getTime()
        });
      } else {
        // Clean up expired rank
        await deleteDoc(doc.ref);
      }
    }
    
    // Sort by expiry time
    activeRanks.sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
    
    res.status(200).json({
      success: true,
      activeRanks: activeRanks,
      totalActive: activeRanks.length
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin route to view all temporary ranks
app.get('/admin/temp-ranks', async (req, res) => {
  try {
    const { adminEmail } = req.query;
    
    // Check if the requesting user is admin
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    const tempRanksCollection = collection(db, 'tempRanks');
    const tempRanksSnapshot = await getDocs(tempRanksCollection);
    
    const tempRanks = [];
    const now = new Date();
    
    tempRanksSnapshot.forEach((doc) => {
      const data = doc.data();
      const expiry = new Date(data.expiresAt);
      
      if (now < expiry) {
        tempRanks.push({
          id: doc.id,
          ...data,
          timeRemaining: Math.max(0, expiry - now)
        });
      }
    });
    
    res.status(200).json({
      success: true,
      tempRanks: tempRanks,
      totalActive: tempRanks.length
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Point request system
let pointRequests = new Map(); // Store pending requests
let userMutes = new Map(); // Store muted users with expiry time
let userWarnings = new Map(); // Store user warning counts

// Check request status for user notifications
app.get('/check-request-status', async (req, res) => {
  try {
    const { requestId, userDisplayName } = req.query;
    
    if (!requestId || !userDisplayName) {
      return res.status(400).json({
        success: false,
        message: 'Request ID and user display name are required'
      });
    }
    
    const request = pointRequests.get(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found or expired'
      });
    }
    
    // Verify the request belongs to this user
    if (request.userDisplayName !== userDisplayName) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.status(200).json({
      success: true,
      status: request.status,
      pointsRequested: request.pointsRequested,
      pointsDeducted: request.pointsDeducted || 0
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});





// Admin update user PIN
app.put('/admin/update-pin', async (req, res) => {
  try {
    const { adminEmail, displayName, newPin } = req.body;
    
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }
    
    // Find user by display name
    const usersCollection = collection(db, 'users');
    const displayNameQuery = query(usersCollection, where('displayName', '==', displayName.trim()));
    const displayNameSnapshot = await getDocs(displayNameQuery);
    
    if (displayNameSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'User with this display name not found.'
      });
    }
    
    // Get the user document
    const userDoc = displayNameSnapshot.docs[0];
    const userId = userDoc.id;
    
    // Update PIN in Firestore
    await setDoc(doc(db, 'users', userId), {
      pin: newPin,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    res.status(200).json({
      success: true,
      message: `PIN updated for ${displayName}`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// User requests points
app.post('/request-points', async (req, res) => {
  try {
    const { userDisplayName, pointsRequested, pin } = req.body;
    
    if (!userDisplayName || !pointsRequested || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Display name, points requested, and PIN are required'
      });
    }
    
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }
    
    // Find user by display name and get their PIN
    const usersCollection = collection(db, 'users');
    const displayNameQuery = query(usersCollection, where('displayName', '==', userDisplayName.trim()));
    const displayNameSnapshot = await getDocs(displayNameQuery);
    
    if (displayNameSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const userDoc = displayNameSnapshot.docs[0];
    const userData = userDoc.data();
    
    // Check if admin has set a PIN for this user
    if (!userData.pin) {
      return res.status(400).json({
        success: false,
        message: 'PIN not set by admin. Please contact admin to set your PIN.'
      });
    }
    
    // Verify PIN
    if (userData.pin !== pin) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect PIN'
      });
    }
    
    if (![1, 2, 3].includes(parseInt(pointsRequested))) {
      return res.status(400).json({
        success: false,
        message: 'Can only request 1, 2, or 3 points'
      });
    }
    
    // Check if user is muted
    const now = Date.now();
    if (userMutes.has(userDisplayName) && userMutes.get(userDisplayName) > now) {
      return res.status(429).json({
        success: false,
        message: 'You are muted for 1 minute. Please wait before making another request.'
      });
    }
    
    // Don't allow admin to request points
    if (userData.email === 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Admin cannot request points'
      });
    }
    
    // Create request ID
    const requestId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Store the request
    pointRequests.set(requestId, {
      id: requestId,
      userId: userDoc.id,
      userDisplayName: userDisplayName,
      userEmail: userData.email,
      pointsRequested: parseInt(pointsRequested),
      timestamp: now,
      status: 'pending'
    });
    
    res.status(200).json({
      success: true,
      message: 'Point request submitted successfully',
      requestId: requestId
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin gets pending requests
app.get('/admin/point-requests', async (req, res) => {
  try {
    const { adminEmail } = req.query;
    
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    // Filter out expired requests (older than 5 minutes)
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    for (const [requestId, request] of pointRequests.entries()) {
      if (request.timestamp < fiveMinutesAgo) {
        pointRequests.delete(requestId);
      }
    }
    
    const pendingRequests = Array.from(pointRequests.values())
      .filter(request => request.status === 'pending')
      .sort((a, b) => b.timestamp - a.timestamp);
    
    res.status(200).json({
      success: true,
      requests: pendingRequests
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin responds to point request
app.post('/admin/respond-point-request', async (req, res) => {
  try {
    const { adminEmail, requestId, action } = req.body; // action: 'approve', 'deny', 'warn', 'mute'
    
    if (adminEmail !== 'mahmod@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    const request = pointRequests.get(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found or expired'
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request already processed'
      });
    }
    
    let responseMessage = '';
    
    if (action === 'approve') {
      // Add points to user
      await setDoc(doc(db, 'users', request.userId), {
        points: (await getDoc(doc(db, 'users', request.userId))).data().points + request.pointsRequested,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      request.status = 'approved';
      responseMessage = `Approved ${request.pointsRequested} points for ${request.userDisplayName}`;
      
    } else if (action === 'deny') {
      request.status = 'denied';
      responseMessage = `Denied point request from ${request.userDisplayName}`;
      
    } else if (action === 'warn') {
      // Increment warning count
      const currentWarnings = userWarnings.get(request.userDisplayName) || 0;
      const newWarnings = currentWarnings + 1;
      userWarnings.set(request.userDisplayName, newWarnings);
      
      if (newWarnings >= 2) {
        // Subtract points after 2 warnings
        const userDoc = await getDoc(doc(db, 'users', request.userId));
        const currentPoints = userDoc.data().points || 0;
        const newPoints = Math.max(0, currentPoints - 3); // Subtract 3 points, minimum 0
        
        await setDoc(doc(db, 'users', request.userId), {
          points: newPoints,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        
        responseMessage = `Warned ${request.userDisplayName} (2nd warning) - 3 points deducted`;
        userWarnings.delete(request.userDisplayName); // Reset warnings after penalty
      } else {
        responseMessage = `Warned ${request.userDisplayName} (Warning ${newWarnings}/2)`;
      }
      
      request.status = 'warned';
      
      // Add flag to indicate if points were deducted
      request.pointsDeducted = newWarnings >= 2 ? 3 : 0;
      
    } else if (action === 'mute') {
      // Mute user for 1 minute
      const muteUntil = Date.now() + (60 * 1000); // 1 minute
      userMutes.set(request.userDisplayName, muteUntil);
      
      request.status = 'muted';
      responseMessage = `Muted ${request.userDisplayName} for 1 minute`;
    }
    
    res.status(200).json({
      success: true,
      message: responseMessage,
      action: action,
      pointsDeducted: request.pointsDeducted || 0
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
