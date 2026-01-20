
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
import { XMarkIcon } from './components/Icons';

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
  
  const [appState, setAppState] = useState<PersistedState>(defaultState);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  
  const isIncomingUpdate = useRef(false);

  const processIncomingState = useCallback((incomingState: Partial<PersistedState>): PersistedState => {
      let mergedState = { ...defaultState, ...incomingState };
      const currentRegions = mergedState.regions || REGIONS;

      const migrateUser = (u: any) => ({
          ...u, 
          active: u.active ?? true,
          email: u.email || '',
          notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(u.notificationPreferences || {}) }
      });
      
      const migrateVendor = (v: any) => ({
          ...migrateUser(v),
          allowedRegions: v.allowedRegions || currentRegions
      });

      if (mergedState.vendors && Array.isArray(mergedState.vendors)) {
          mergedState.vendors = mergedState.vendors.map(migrateVendor);
          
          // CRITICAL: Ensure Dharmesh account ALWAYS exists in the vendor list
          const masterVendor = VENDORS[0];
          const hasMaster = mergedState.vendors.some((v: Vendor) => v.username.toLowerCase() === masterVendor.username.toLowerCase());
          if (!hasMaster) {
              mergedState.vendors.push(migrateVendor(masterVendor));
          }
      } else {
          mergedState.vendors = VENDORS.map(migrateVendor);
      }

      if (mergedState.bdms) mergedState.bdms = mergedState.bdms.map(migrateUser);
      
      if (mergedState.managers && Array.isArray(mergedState.managers)) {
          mergedState.managers = mergedState.managers.map(migrateUser);
          const defaultAdmin = MANAGERS[0];
          const adminIndex = mergedState.managers.findIndex((m: Manager) => m.username === defaultAdmin.username);
          if (adminIndex !== -1) {
             mergedState.managers[adminIndex].password = defaultAdmin.password;
             mergedState.managers[adminIndex].active = true;
          } else {
             mergedState.managers.push(migrateUser(defaultAdmin));
          }
      } else {
          mergedState.managers = MANAGERS.map(migrateUser);
      }

      return mergedState;
  }, []);

  useEffect(() => {
    if (isFirebaseReady && !isIncomingUpdate.current) {
        saveStateToFirebase(appState);
    }
    isIncomingUpdate.current = false;
  }, [appState, isFirebaseReady]);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
        const saved = localStorage.getItem('vendorBookingAppState');
        if (saved) setAppState(JSON.parse(saved));
        return;
    }

    let unsubscribe: () => void;

    signInAnonymously(auth).then(() => {
        unsubscribe = subscribeToState((remoteData) => {
            if (Object.keys(remoteData).length > 0) {
                const processed = processIncomingState(remoteData);
                isIncomingUpdate.current = true;
                setAppState(processed);
                localStorage.setItem('vendorBookingAppState', JSON.stringify(processed));
            }
            setIsFirebaseReady(true);
            setFirebaseError(null);
        }, (err) => {
            setFirebaseError(err.message);
        });
    }).catch(err => {
        setFirebaseError("Auth Error: Enable Anonymous Sign-in in Firebase Console.");
    });

    return () => { if (unsubscribe) unsubscribe(); };
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

  const updateState = (key: keyof PersistedState, updater: any) => {
      setAppState(prev => ({
          ...prev,
          [key]: typeof updater === 'function' ? updater(prev[key]) : updater
      }));
  };

  const salespeopleCount = useMemo(() => {
    return regions.reduce((acc, region) => {
        acc[region] = bdms.filter(bdm => bdm.region === region && bdm.active !== false).length;
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
        />
      ) : (
        <>
            <div className="fixed top-4 left-4 z-[60] flex items-center gap-2 pointer-events-none">
                <div className={`w-2 h-2 rounded-full ${isFirebaseReady ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{isFirebaseReady ? 'Live' : 'Offline'}</span>
            </div>
            {renderDashboard()}
        </>
      )}
    </>
  );
};

export default App;
