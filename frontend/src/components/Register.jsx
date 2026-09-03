import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import { useAppContext } from '../context/AppContext';
import { Card, Input, Button } from './ui';
import { User, Loader, CheckCircle } from 'lucide-react';

/** The centred panel both states of this screen sit in. */
const Frame = ({ children }) => (
    <Box
        sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.50',
            px: 2,
            py: 6
        }}
    >
        <Card sx={{ maxWidth: 440, width: '100%', p: 4 }}>{children}</Card>
    </Box>
);

const Register = ({ onSwitchToLogin }) => {
    const { register, loading, error } = useAppContext();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [localError, setLocalError] = useState('');
    const [registered, setRegistered] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');

        if (password !== confirmPassword) {
            setLocalError('Passwörter stimmen nicht überein.');
            return;
        }

        try {
            await register({ name, email, password, confirmPassword });
            setRegistered(true);
        } catch (err) {
            setLocalError(err.message || 'Registrierung fehlgeschlagen.');
        }
    };

    if (registered) {
        return (
            <Frame>
                <Stack spacing={3} sx={{textAlign: 'center'}}>
                    <Box sx={{ color: 'success.main', display: 'flex', justifyContent: 'center' }}>
                        <CheckCircle size={64} />
                    </Box>
                    <Typography variant="h4" component="h2" fontWeight={800}>
                        Registrierung erfolgreich!
                    </Typography>
                    <Typography color="text.secondary">
                        Ihr Konto wurde erstellt. Bitte überprüfen Sie Ihre E-Mails, um Ihr Konto zu
                        verifizieren (in dieser Demo können Sie sich direkt anmelden).
                    </Typography>
                    <Button onClick={onSwitchToLogin} fullWidth>
                        Zum Login
                    </Button>
                </Stack>
            </Frame>
        );
    }

    return (
        <Frame>
            <Stack spacing={3}>
                <Box sx={{textAlign: 'center'}}>
                    <Typography variant="h4" component="h2" fontWeight={800}>
                        Konto erstellen
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                        Oder{' '}
                        <Link component="button" type="button" onClick={onSwitchToLogin} fontWeight={500}>
                            melden Sie sich mit Ihrem bestehenden Konto an
                        </Link>
                    </Typography>
                </Box>

                {(error || localError) && (
                    <Alert severity="error">{localError || error}</Alert>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                    <Stack spacing={2}>
                        <Input
                            label="Vollständiger Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
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
                            hint="Muss enthalten: Großbuchstabe, Kleinbuchstabe, Zahl und Sonderzeichen"
                        />
                        <Input
                            label="Passwort bestätigen"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            disabled={loading}
                            icon={loading ? Loader : User}
                        >
                            Registrieren
                        </Button>
                    </Stack>
                </Box>
            </Stack>
        </Frame>
    );
};

export default Register;
