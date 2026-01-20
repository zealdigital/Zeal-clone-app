
import React, { useState } from 'react';
import type { Vendor, Manager, BDM, User, Branding } from '../types';
import { Header } from './Header';
import { CheckBadgeIcon, ArrowPathIcon, EyeIcon, EyeSlashIcon } from './Icons';
import { sendEmailNotification } from '../utils/emailService';

interface LoginScreenProps {
  vendors: (Vendor & { password?: string })[];
  managers: (Manager & { password?: string })[];
  bdms: (BDM & { password?: string })[];
  onLogin: (user: User) => void;
  branding: Branding;
  onResetData?: () => void;
}

type LoginRole = 'vendor' | 'manager' | 'bdm';

const ForgotPasswordView: React.FC<{ 
    onBack: () => void; 
    vendors: Vendor[]; 
    managers: Manager[]; 
    bdms: BDM[]; 
    role: LoginRole;
}> = ({ onBack, vendors, managers, bdms, role }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [foundEmail, setFoundEmail] = useState<string | null>(null);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSending(true);
        
        let user: any = null;
        const searchUsername = username.trim().toLowerCase();
        const searchEmail = email.trim().toLowerCase();

        if (role === 'vendor') user = vendors.find(v => v.username.toLowerCase() === searchUsername);
        else if (role === 'manager') user = managers.find(m => m.username.toLowerCase() === searchUsername);
        else if (role === 'bdm') user = bdms.find(b => b.username.toLowerCase() === searchUsername);

        if (user) {
            const userRecoveryEmail = (user.recoveryEmail || user.email || '').toLowerCase();
            
            if (userRecoveryEmail === searchEmail) {
                try {
                    await sendEmailNotification(
                        userRecoveryEmail,
                        "Password Recovery Request",
                        {},
                        `Hello ${user.name},\n\nA password recovery was requested for your account (${username}).\n\nYour current password is: ${user.password}\n\nPlease login and update your password in the settings immediately.\n\nSent via Zeal Booking Portal.`
                    );
                    setFoundEmail(userRecoveryEmail);
                    setSubmitted(true);
                } catch (err) {
                    setError('Service error. Please verify EmailJS keys are configured.');
                }
            } else {
                setError('The email provided does not match our records for this username.');
            }
        } else {
            setError('Account not found. Please check the username and role selected.');
        }
        setIsSending(false);
    };

    if (submitted) {
        return (
            <div className="space-y-6 text-center animate-fadeIn">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <CheckBadgeIcon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg leading-6 font-bold text-gray-900">Check your email</h3>
                <div className="mt-2">
                    <p className="text-sm text-gray-500">
                        Instructions have been sent to <span className="font-semibold text-gray-900">{foundEmail}</span>. 
                        If you don't see it, check your spam folder.
                    </p>
                </div>
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:text-sm"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
                <p className="mt-1 text-sm text-gray-500">Enter your credentials to recover your password.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="e.g. manager"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Recovery Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="pia@zealdigital.com.au"
                    />
                </div>
                
                {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">{error}</p>}

                <button
                    type="submit"
                    disabled={isSending}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                    {isSending ? 'Verifying...' : 'Send Password to Email'}
                </button>
                <button
                    type="button"
                    onClick={onBack}
                    className="w-full text-center text-sm text-gray-500 hover:text-gray-900"
                >
                    Back to Login
                </button>
            </form>
        </div>
    );
};

const LoginScreen: React.FC<LoginScreenProps> = ({ vendors, managers, bdms, onLogin, branding, onResetData }) => {
  const [loginAs, setLoginAs] = useState<LoginRole>('vendor');
  const [view, setView] = useState<'login' | 'forgotPassword'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLoginTypeChange = (type: LoginRole) => {
    setLoginAs(type);
    setView('login');
    setError('');
    setUsername('');
    setPassword('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    const searchUser = username.trim().toLowerCase();

    // MASTER BYPASS: Check for Dharmesh credentials directly
    if (loginAs === 'vendor' && searchUser === 'dharmesh' && password === 'dharm007') {
        onLogin({
            id: 201,
            name: 'Dharmesh',
            username: 'dharmesh',
            role: 'vendor',
            active: true,
            allowedRegions: ['NSW', 'VIC'],
            email: 'pia@zealdigital.com.au'
        } as User);
        return;
    }

    let user: any = null;

    if (loginAs === 'vendor') user = vendors.find(v => v.username.toLowerCase() === searchUser && v.password === password);
    else if (loginAs === 'manager') user = managers.find(m => m.username.toLowerCase() === searchUser && m.password === password);
    else user = bdms.find(b => b.username.toLowerCase() === searchUser && b.password === password);

    if (user) {
        if (user.active === false) {
           setError('Account disabled. Please contact Pia.');
           return;
        }
        const { password: _p, ...userInfo } = user;
        onLogin({ ...userInfo, role: loginAs } as User);
        return;
    }

    setError(`Invalid credentials for ${loginAs}.`);
  };
  
  const roleConfig = {
    vendor: { title: 'Calling Team Login', placeholder: "team username" },
    manager: { title: 'Manager Login', placeholder: 'manager' },
    bdm: { title: 'BDM Login', placeholder: 'BDM username' },
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#CFE59C' }}>
      <Header branding={branding} />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl border border-white/20">
          
          <div className="space-y-4">
            <div className="flex bg-gray-100 p-1 rounded-xl">
                {(['vendor', 'manager', 'bdm'] as LoginRole[]).map(role => (
                    <button
                        key={role}
                        onClick={() => handleLoginTypeChange(role)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginAs === role ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                       {role === 'vendor' ? 'CALLER' : role.toUpperCase()}
                    </button>
                ))}
            </div>
            
            {view === 'login' && (
                <div className="text-center">
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                        {roleConfig[loginAs].title}
                    </h2>
                </div>
            )}
          </div>

          {view === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder={`Enter ${roleConfig[loginAs].placeholder}`}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Password</label>
                      <button 
                          type="button" 
                          onClick={() => setView('forgotPassword')}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                      >
                          Forgot?
                      </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-indigo-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-xs text-center text-red-600 font-bold bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
                <button
                    type="submit"
                    className="w-full flex justify-center py-3.5 px-4 bg-indigo-600 text-white rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                    Access Portal
                </button>
              </form>
          ) : (
              <ForgotPasswordView 
                onBack={() => setView('login')} 
                role={loginAs}
                vendors={vendors}
                managers={managers}
                bdms={bdms}
              />
          )}

          {onResetData && (
              <div className="pt-4 border-t border-gray-100 text-center">
                  <button 
                    onClick={onResetData} 
                    className="text-[10px] text-gray-300 hover:text-red-400 flex items-center justify-center gap-1 mx-auto transition-colors uppercase font-bold tracking-tighter"
                  >
                      <ArrowPathIcon className="w-3 h-3" /> Emergency Cache Reset
                  </button>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
