import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { Tourist, Incident, Advisory } from "../types";

// 1. Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// 3. Initialize Firestore with custom database ID if specified
const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// User Profile Type in Firestore
export interface AppUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: "ranger" | "dispatcher" | "admin" | "tourist";
  badgeNumber?: string;
  station?: string;
  lastLogin: string;
}

// Google Sign-In
export async function signInWithGoogle(): Promise<AppUserProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  
  const userProfile: AppUserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || "Field Officer",
    photoURL: user.photoURL,
    role: "ranger",
    badgeNumber: `STR-${user.uid.slice(0, 5).toUpperCase()}`,
    station: "Hasanur Central Command",
    lastLogin: new Date().toISOString(),
  };

  // Sync to Firestore 'users' collection
  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, userProfile, { merge: true });
  } catch (err) {
    console.warn("Could not sync user profile to Firestore:", err);
  }

  return userProfile;
}

// Sign Out
export async function logOut(): Promise<void> {
  await signOut(auth);
}

// Auth State Listener
export function subscribeToAuth(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// ==========================================
// PERSON & TOURIST DATA PERSISTENCE (FIRESTORE)
// ==========================================

// Seed initial persons if Firestore tourists collection is empty
export async function seedTouristsIfEmpty(initialTourists: Tourist[]): Promise<void> {
  try {
    const colRef = collection(db, "tourists");
    const snapshot = await getDocs(colRef);
    if (snapshot.empty && initialTourists.length > 0) {
      console.log("Seeding initial persons data into Firestore...");
      for (const tourist of initialTourists) {
        await setDoc(doc(db, "tourists", tourist.id), {
          ...tourist,
          bloodGroup: tourist.bloodGroup || "O+ (Pos)",
          emergencyContact: tourist.emergencyContact || "Sathyamangalam Forest Post (04295-240228)",
          medicalNotes: tourist.medicalNotes || "No known severe allergies. Standard wilderness pack.",
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("Error seeding initial tourists:", err);
  }
}

// Real-time listener for all tracked persons/tourists
export function subscribeToTourists(
  onUpdate: (tourists: Tourist[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, "tourists");
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Tourist[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...(doc.data() as any) });
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    },
    (err) => {
      console.warn("Firestore tourists subscription error:", err);
      if (onError) onError(err);
    }
  );
}

// Save or Update Person Data in Firestore
export async function savePersonToFirestore(person: Tourist): Promise<void> {
  const docRef = doc(db, "tourists", person.id);
  await setDoc(docRef, {
    ...person,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

// Delete Person from Firestore
export async function deletePersonFromFirestore(personId: string): Promise<void> {
  const docRef = doc(db, "tourists", personId);
  await deleteDoc(docRef);
}

// Batch Update Status for Multiple Tourists in Firestore
export async function batchUpdateTouristsStatus(
  touristIds: string[],
  status: "safe" | "warning" | "danger",
  reason?: string
): Promise<void> {
  if (!touristIds || touristIds.length === 0) return;
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  
  for (const id of touristIds) {
    const docRef = doc(db, "tourists", id);
    const updatePayload: Record<string, any> = {
      status,
      lastUpdate: now,
      updatedAt: now,
    };
    if (reason && reason.trim()) {
      updatePayload.notes = `[STATUS OVERRIDE: ${status.toUpperCase()}] ${reason.trim()} (${new Date().toLocaleTimeString()})`;
    }
    batch.update(docRef, updatePayload);
  }

  await batch.commit();
}

// Batch Send Broadcast Alert to Multiple Tourists & Log Advisory
export async function batchBroadcastAlertToTourists(
  touristIds: string[],
  message: string,
  severity: "advisory" | "warning" | "danger" = "advisory",
  title?: string
): Promise<void> {
  if (!touristIds || touristIds.length === 0 || !message) return;
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const alertTitle = title || `BROADCAST ALERT: ${severity.toUpperCase()}`;

  // 1. Create a system advisory entry in Firestore
  const advisoryRef = doc(collection(db, "advisories"));
  batch.set(advisoryRef, {
    id: advisoryRef.id,
    title: alertTitle,
    content: message,
    timestamp: now,
    type: severity === "danger" ? "hazard" : severity === "warning" ? "weather" : "general",
    author: "Tactical Dispatch Desk",
    targetTouristIds: touristIds,
  });

  // 2. Update target tourists' notes & status if critical
  for (const id of touristIds) {
    const docRef = doc(db, "tourists", id);
    const updates: Record<string, any> = {
      lastUpdate: now,
      updatedAt: now,
      notes: `[BROADCAST ${severity.toUpperCase()}] ${message}`,
    };
    if (severity === "danger") {
      updates.status = "warning"; // flag warning so rangers attend immediately
    }
    batch.update(docRef, updates);
  }

  await batch.commit();
}

// ==========================================
// INCIDENTS DATA PERSISTENCE (FIRESTORE)
// ==========================================

export async function seedIncidentsIfEmpty(initialIncidents: Incident[]): Promise<void> {
  try {
    const colRef = collection(db, "incidents");
    const snapshot = await getDocs(colRef);
    if (snapshot.empty && initialIncidents.length > 0) {
      for (const incident of initialIncidents) {
        await setDoc(doc(db, "incidents", incident.id), incident);
      }
    }
  } catch (err) {
    console.error("Error seeding initial incidents:", err);
  }
}

export function subscribeToIncidents(
  onUpdate: (incidents: Incident[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, "incidents");
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Incident[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...(doc.data() as any) });
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    },
    (err) => {
      console.warn("Firestore incidents subscription error:", err);
      if (onError) onError(err);
    }
  );
}

export async function updateIncidentInFirestore(incidentId: string, updates: Partial<Incident>): Promise<void> {
  const docRef = doc(db, "incidents", incidentId);
  await updateDoc(docRef, updates as any);
}
