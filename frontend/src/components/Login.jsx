import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, Input, Button } from './ui';
import { Lock, AlertCircle, Loader } from 'lucide-react';

const Login = ({ onSwitchToRegister }) => {
    const { login, loading, error } = useAppContext();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        
        if (!email || !password) {
            setLocalError('Bitte geben Sie E-Mail und Passwort ein.');
            return;
        }

        try {
            await login(email, password);
        } catch (err) {
            setLocalError(err.message || 'Login fehlgeschlagen. Bitte überprüfen Sie Ihre Daten.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="max-w-md w-full space-y-8 p-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Anmelden
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Oder{' '}
                        <button
                            onClick={onSwitchToRegister}
                            className="font-medium text-blue-600 hover:text-blue-500"
                        >
                            erstellen Sie ein neues Konto
                        </button>
                    </p>
                </div>
                
                {(error || localError) && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertCircle className="h-5 w-5 text-red-400" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">
                                    {localError || error}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <Input
                            label="E-Mail-Adresse"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <Input
                            label="Passwort"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={loading}
                        icon={loading ? Loader : Lock}
                    >
                        Anmelden
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default Login;
