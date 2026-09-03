import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import {Calendar, Check, Clock, Cloud} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import {Card, Badge} from './ui';

/**
 * Responsive columns without pulling in Grid.
 *
 * `display: grid` with a breakpoint object does what the Tailwind
 * `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` did, and it is one prop rather
 * than a Grid container plus an item wrapper per child.
 */
const columns = (breakpoints) => ({
    display: 'grid',
    gap: 3,
    gridTemplateColumns: Object.fromEntries(
        Object.entries(breakpoints).map(([at, count]) => [at, `repeat(${count}, minmax(0, 1fr))`])
    )
});

const Dashboard = () => {
    const {bookings, options, platforms, loading} = useAppContext();

    if (loading) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256}}>
                <CircularProgress size={48}/>
            </Box>
        );
    }

    const connectedPlatforms = platforms.filter(p => p.connected).length;
    const upcomingBookings = bookings.filter(b => new Date(b.startDate) > new Date()).length;
    const activeOptions = options.filter(o => o.status === 'pending').length;

    const stats = [
        {title: 'Anstehende Buchungen', value: upcomingBookings, icon: Calendar, color: 'primary.main'},
        {title: 'Offene Optionen', value: activeOptions, icon: Clock, color: 'warning.main'},
        {
            title: 'Verbundene Plattformen',
            value: `${connectedPlatforms}/${platforms.length}`,
            icon: Cloud,
            color: 'success.main'
        },
        {title: 'Profil-Status', value: 'Aktuell', icon: Check, color: 'success.main'}
    ];

    return (
        <Stack spacing={3}>
            <Typography variant="h4" component="h1" fontWeight={700}>Dashboard</Typography>

            <Box sx={columns({xs: 1, md: 2, lg: 4})}>
                {stats.map((stat, index) => (
                    <Card key={index}>
                        <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                            <Box>
                                <Typography variant="body2" color="text.secondary" sx={{mb: 0.5}}>
                                    {stat.title}
                                </Typography>
                                <Typography variant="h5" fontWeight={700}>{stat.value}</Typography>
                            </Box>
                            <Box sx={{color: stat.color, display: 'flex'}}>
                                <stat.icon size={32}/>
                            </Box>
                        </Stack>
                    </Card>
                ))}
            </Box>

            <Box sx={columns({xs: 1, lg: 3})}>
                <Box sx={{gridColumn: {lg: 'span 2'}}}>
                    <Card>
                        <Typography variant="h6" sx={{mb: 2}}>Nächste Termine</Typography>
                        <Stack spacing={1.5}>
                            {bookings.slice(0, 3).map((booking) => (
                                <Stack
                                    key={booking.id}
                                    direction="row"
                                    sx={{alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'grey.50', borderRadius: 2}}
                                >
                                    <Box>
                                        <Typography fontWeight={500}>{booking.title}</Typography>
                                        {/* The production and the role, not `booking.type`,
                                            which is an enum and rendered as the bare word
                                            "other" for every entry that never chose one. */}
                                        <Typography variant="body2" color="text.secondary">
                                            {[
                                                new Date(booking.startDate).toLocaleDateString('de-DE'),
                                                booking.production,
                                                booking.role
                                            ].filter(Boolean).join(' · ')}
                                        </Typography>
                                    </Box>
                                    <Badge color={booking.status === 'confirmed' ? 'green' : 'yellow'}>
                                        {booking.status === 'confirmed' ? 'Bestätigt' : 'Offen'}
                                    </Badge>
                                </Stack>
                            ))}
                        </Stack>
                    </Card>
                </Box>

                <Box>
                    <Card>
                        <Typography variant="h6" sx={{mb: 2}}>Plattform-Status</Typography>
                        {/*
                          Connected first, and the list scrolls inside its own card.
                          Fourteen rows at full height made this column twice as tall
                          as the one beside it and left the dashboard bottom-heavy,
                          with the platforms that actually sync at the far end.
                        */}
                        <Stack spacing={1.5} sx={{maxHeight: 320, overflowY: 'auto', pr: 0.5}}>
                            {[...platforms]
                                .sort((a, b) => Number(b.connected) - Number(a.connected))
                                .map((platform) => (
                                <Stack
                                    key={platform.id}
                                    direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                                    <Box>
                                        <Typography variant="body2" fontWeight={500}>{platform.name}</Typography>
                                        {/* `new Date(null)` is the epoch, so a platform that
                                            has never been synced reported "Sync: 1.1.1970". */}
                                        <Typography variant="caption" color="text.secondary">
                                            {!platform.connected && 'Nicht verbunden'}
                                            {platform.connected && !platform.lastSync && 'Noch nie synchronisiert'}
                                            {platform.connected && platform.lastSync
                                                && `Sync: ${new Date(platform.lastSync).toLocaleDateString('de-DE')}`}
                                        </Typography>
                                    </Box>
                                    <Badge color={platform.connected ? 'green' : 'gray'}>
                                        {platform.connected ? 'Aktiv' : 'Inaktiv'}
                                    </Badge>
                                </Stack>
                                ))}
                        </Stack>
                    </Card>
                </Box>
            </Box>
        </Stack>
    );
};

export default Dashboard;
