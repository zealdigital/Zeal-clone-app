
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Vendor, Booking, User, Manager, LeaveDay, PublicHoliday, Region, AppointmentSlotsConfig, BDM, Notification, ManagerAppointment, Branding, PersistedState } from './types';
import { VENDORS, MANAGERS, PUBLIC_HOLIDAYS, APPOINTMENT_TIMES, BDMS, REGIONS, DEFAULT_BRANDING, DEFAULT_REGION_COLORS, DEFAULT_NOTIFICATION_PREFERENCES } from './constants';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import ManagerDashboard from './components/ManagerDashboard';
import BdmDashboard from './components/BdmDashboard';
import { subscribeToState, saveStateToFirebase } from './services/firebaseService';
import { isFirebaseConfigured, auth } from './firebaseConfig';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

const defaultState: PersistedState = {
  allBookings: [],
  publicHolidays: PUBLIC_HOLIDAYS,
  appointmentTimes: APPOINTMENT_TIMES,
  leaveDays: [],
  bdms: BDMS,
  vendors: VENDORS,
  managers: MANAGERS,
  notifications: [],
  managerAppointments: [],
  branding: DEFAULT_BRANDING,
  regions: REGIONS,
  regionColors: DEFAULT_REGION_COLORS,
};

function adjustColor(col: string, amt: number) {
    let usePound = false;
    if (col[0] === "#") {
        col = col.slice(1);
        usePound = true;
    }
    let num = parseInt(col, 16);
    let r = (num >> 16) + amt;
    if (r > 255) r = 255; else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amt;
    if (b > 255) b = 255; else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amt;
    if (g > 255) g = 255; else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const storedUser = localStorage.getItem('vendorBookingCurrentUser');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch { return null; }
  });
  
  const [appState, setAppState] = useState<PersistedState>(() => {
    try {
      const saved = localStorage.getItem('vendorBookingAppState');
      return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
    } catch {
      return defaultState;
    }
  });
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  
  const processIncomingState = useCallback((incomingState: Partial<PersistedState>): PersistedState => {
      // Start with a clean copy of defaultState
      const mergedState = { ...defaultState };
      
      // Only merge keys that are actually present in the incoming state
      // This prevents defaultState's empty arrays (like vendors: []) from 
      // being processed as "new data" if incomingState doesn't have the key yet.
      Object.keys(incomingState).forEach(key => {
          const k = key as keyof PersistedState;
          if (incomingState[k] !== undefined) {
              (mergedState as any)[k] = incomingState[k];
          }
      });

      const currentRegions = mergedState.regions || REGIONS;

      const migrateUser = (u: any) => {
          if (!u) return null;
          return {
              ...u, 
              active: u.active ?? true,
              email: u.email || '',
              notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(u.notificationPreferences || {}) }
          };
      };
      
      const migrateVendor = (v: any) => {
          const user = migrateUser(v);
          if (!user) return null;
          return {
              ...user,
              allowedRegions: v.allowedRegions || currentRegions
          };
      };

      // Handle Vendors
      if (incomingState.vendors && Array.isArray(incomingState.vendors)) {
          mergedState.vendors = incomingState.vendors.map(migrateVendor).filter(Boolean);
      } else if (!mergedState.vendors || mergedState.vendors.length === 0) {
          mergedState.vendors = VENDORS.map(migrateVendor).filter(Boolean);
      }
      
      const masterVendor = VENDORS[0];
      if (masterVendor) {
          const hasMaster = (mergedState.vendors || []).some((v: Vendor) => v.username.toLowerCase() === masterVendor.username.toLowerCase());
          if (!hasMaster) {
              if (!mergedState.vendors) mergedState.vendors = [];
              mergedState.vendors.push(migrateVendor(masterVendor) as Vendor);
          }
      }

      // Handle BDMs
      if (incomingState.bdms && Array.isArray(incomingState.bdms)) {
          mergedState.bdms = incomingState.bdms.map(migrateUser).filter(Boolean);
      } else if (!mergedState.bdms || mergedState.bdms.length === 0) {
          mergedState.bdms = BDMS.map(migrateUser).filter(Boolean);
      }
      
      const masterBdm = BDMS[0];
      if (masterBdm) {
          const hasMaster = (mergedState.bdms || []).some((b: BDM) => b.username.toLowerCase() === masterBdm.username.toLowerCase());
          if (!hasMaster) {
              if (!mergedState.bdms) mergedState.bdms = [];
              mergedState.bdms.push(migrateUser(masterBdm) as BDM);
          }
      }
      
      // Handle Managers
      if (incomingState.managers && Array.isArray(incomingState.managers)) {
          mergedState.managers = incomingState.managers.map(migrateUser).filter(Boolean);
      } else if (!mergedState.managers || mergedState.managers.length === 0) {
          mergedState.managers = MANAGERS.map(migrateUser).filter(Boolean);
      }
      
      const defaultAdmin = MANAGERS[0];
      if (defaultAdmin) {
          const adminIndex = (mergedState.managers || []).findIndex((m: Manager) => m.username === defaultAdmin.username);
          if (adminIndex !== -1) {
             mergedState.managers[adminIndex].password = defaultAdmin.password;
             mergedState.managers[adminIndex].active = true;
          } else {
             if (!mergedState.managers) mergedState.managers = [];
             mergedState.managers.push(migrateUser(defaultAdmin) as Manager);
          }
      }

      return mergedState;
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
        const saved = localStorage.getItem('vendorBookingAppState');
        if (saved) setAppState(JSON.parse(saved));
        return;
    }

    let unsubscribe: (() => void) | undefined;
    let active = true;

    signInAnonymously(auth).then(() => {
        if (!active) return;
        
        const setupListener = () => {
            if (unsubscribe) unsubscribe();
            unsubscribe = subscribeToState((remoteData) => {
                if (!active) return;
                const processed = processIncomingState(remoteData);
                setAppState(processed);
                
                // Only mark as ready if we have the configuration data (which includes managers)
                // At minimum, the default 'manager' should be present.
                if (remoteData.managers || remoteData.vendors || remoteData.bdms) {
                    setIsFirebaseReady(true);
                }
                setFirebaseError(null);
            }, (err) => {
                if (!active) return;
                console.error("Firebase Sync Error:", err);
                setFirebaseError(err.message);
                // If it's not a permission error, try to reconnect after 5 seconds
                if (err.code !== 'permission-denied') {
                    setTimeout(() => {
                        if (active) setupListener();
                    }, 5000);
                }
            });
        };

        setupListener();
    }).catch(err => {
        if (!active) return;
        setFirebaseError("Auth Error: Enable Anonymous Sign-in in Firebase Console.");
    });

    return () => { 
        active = false;
        if (unsubscribe) unsubscribe(); 
    };
  }, [processIncomingState]);

  const { allBookings, publicHolidays, appointmentTimes, leaveDays, bdms, vendors, managers, notifications, managerAppointments, branding, regions, regionColors } = appState;

  useEffect(() => {
    const color = branding.primaryColor;
    const hoverColor = adjustColor(color, -20);
    const paleBg = color + '15';
    const borderPale = color + '40';

    const styleContent = `
      .bg-indigo-600 { background-color: ${color} !important; }
      .text-indigo-600 { color: ${color} !important; }
      .border-indigo-600 { border-color: ${color} !important; }
      .ring-indigo-600 { --tw-ring-color: ${color} !important; }
      .hover\\:bg-indigo-700:hover { background-color: ${hoverColor} !important; }
      .text-indigo-500 { color: ${color} !important; }
      .bg-indigo-50 { background-color: ${paleBg} !important; }
      .border-indigo-200 { border-color: ${borderPale} !important; }
    `;
    
    let styleEl = document.getElementById('theme-overrides');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'theme-overrides';
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = styleContent;
  }, [branding]);

  useEffect(() => {
    // Exclude large data sets (already synced via Firebase) from localStorage to avoid QuotaExceededError
    const { allBookings, notifications, ...configState } = appState;
    localStorage.setItem('vendorBookingAppState', JSON.stringify(configState));
  }, [appState]);

  /**
   * REFACTORED: Targeted Write-Through Update
   * This ensures that every state change is immediately persisted to Firestore.
   */
  const updateState = useCallback(<K extends keyof PersistedState>(key: K, updater: ((prev: PersistedState[K]) => PersistedState[K]) | PersistedState[K]) => {
      setAppState(prev => {
          const currentValue = prev[key];
          const newValue = typeof updater === 'function' ? (updater as any)(currentValue) : updater;
          
          // Simple equality check to avoid redundant updates
          if (currentValue === newValue) return prev;

          // Persist the specific change to Firebase immediately
          if (isFirebaseConfigured) {
              saveStateToFirebase({ [key]: newValue });
          }
          
          return {
              ...prev,
              [key]: newValue
          };
      });
  }, []);

  const salespeopleCount = useMemo(() => {
    return regions.reduce((acc, region) => {
        const normalizedRegion = region.trim().toUpperCase();
        acc[normalizedRegion] = bdms.filter(bdm => 
            bdm.region.trim().toUpperCase() === normalizedRegion && 
            bdm.active !== false
        ).length;
        return acc;
    }, {} as Record<Region, number>);
  }, [bdms, regions]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('vendorBookingCurrentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('vendorBookingCurrentUser');
  };

  const handleUpdateProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('vendorBookingCurrentUser', JSON.stringify(updatedUser));
    if (updatedUser.role === 'manager') updateState('managers', (prev: Manager[]) => prev.map(m => m.id === updatedUser.id ? updatedUser : m));
    else if (updatedUser.role === 'vendor') updateState('vendors', (prev: Vendor[]) => prev.map(v => v.id === updatedUser.id ? updatedUser : v));
    else if (updatedUser.role === 'bdm') updateState('bdms', (prev: BDM[]) => prev.map(b => b.id === updatedUser.id ? updatedUser : b));
  };

  const handleResetData = () => {
      if (window.confirm("WARNING: This clears all Local Storage and reloads. Continue?")) {
          localStorage.removeItem('vendorBookingAppState');
          localStorage.removeItem('vendorBookingCurrentUser');
          window.location.reload();
      }
  };

  const renderDashboard = () => {
    if (!currentUser) return null;
    const commonProps = {
        onLogout: handleLogout, allBookings, 
        setAllBookings: (val: any) => updateState('allBookings', val),
        notifications, 
        setNotifications: (val: any) => updateState('notifications', val),
        branding, regions, regionColors, onUpdateProfile: handleUpdateProfile,
        managerAppointments,
        setManagerAppointments: (val: any) => updateState('managerAppointments', val),
    };

    switch (currentUser.role) {
      case 'manager':
        return (
          <ManagerDashboard
            {...commonProps}
            currentUser={currentUser as Extract<User, { role: 'manager' }>}
            salespeopleCount={salespeopleCount}
            publicHolidays={publicHolidays}
            setPublicHolidays={(val: any) => updateState('publicHolidays', val)}
            appointmentTimes={appointmentTimes}
            setAppointmentTimes={(val: any) => updateState('appointmentTimes', val)}
            leaveDays={leaveDays}
            setLeaveDays={(val: any) => updateState('leaveDays', val)}
            vendors={vendors}
            setVendors={(val: any) => updateState('vendors', val)}
            bdms={bdms}
            setBdms={(val: any) => updateState('bdms', val)}
            managers={managers}
            setManagers={(val: any) => updateState('managers', val)}
            setBranding={(val: any) => updateState('branding', val)}
            setRegions={(val: any) => updateState('regions', val)}
            setRegionColors={(val: any) => updateState('regionColors', val)}
          />
        );
      case 'vendor':
        return (
          <Dashboard
            {...commonProps}
            currentUser={currentUser as Extract<User, { role: 'vendor' }>}
            salespeopleCount={salespeopleCount}
            publicHolidays={publicHolidays}
            appointmentTimes={appointmentTimes}
            leaveDays={leaveDays}
            bdms={bdms}
            vendors={vendors}
            managers={managers} 
            personalAppointments={managerAppointments}
            setPersonalAppointments={(val: any) => updateState('managerAppointments', val)}
          />
        );
      case 'bdm':
        return (
          <BdmDashboard
            {...commonProps}
            currentUser={currentUser as Extract<User, { role: 'bdm' }>}
            vendors={vendors}
            managers={managers}
            salespeopleCount={salespeopleCount}
            appointmentTimes={appointmentTimes}
            personalAppointments={managerAppointments}
            setPersonalAppointments={(val: any) => updateState('managerAppointments', val)}
            publicHolidays={publicHolidays}
            leaveDays={leaveDays}
          />
        );
      default: return null;
    }
  }

  return (
    <>
      <div className={`fixed top-0 left-0 right-0 z-[100] text-[10px] text-center transition-all ${isFirebaseReady ? 'h-0 overflow-hidden' : 'bg-indigo-600 text-white p-1'}`}>
          Connecting to Real-time Sync Engine...
      </div>
      {firebaseError && (
        <div className="bg-red-600 text-white px-4 py-2 text-xs flex items-center justify-between sticky top-0 z-[101]">
           <span className="font-bold uppercase tracking-widest">⚠️ Connection Lost: {firebaseError}</span>
           <button onClick={() => window.location.reload()} className="underline font-bold">Retry Connection</button>
        </div>
      )}
      {!currentUser ? (
        <LoginScreen 
            vendors={vendors} 
            managers={managers} 
            bdms={bdms}
            onLogin={handleLogin}
            branding={branding}
            onResetData={handleResetData}
            isFirebaseReady={isFirebaseReady}
        />
      ) : (
        <>
            {renderDashboard()}
        </>
      )}
    </>
  );
};

export default App;
