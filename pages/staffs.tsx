import { Add } from '@mui/icons-material';
import { Fab, Typography } from '@mui/material';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import LoadingScreen from '../components/loading';
import PageLayout from '../components/pageLayout';
import PendingStaffsDialog from '../components/pendingStaffsDialog';
import FullHeightScrollableContainer from '../components/scrollableContainer';
import StaffList from '../components/staffList';
import { useListPendingStaffs } from '../lib/firebaseFunctionHooks';
import { useStaffUser, useStaffs } from '../lib/firestoreHooks';
import { useGuardIsConnected } from '../lib/hooks';

const StaffPage: NextPage = () => {
    useGuardIsConnected();
    const staff = useStaffUser();
    const staffs = useStaffs();
    const [pendingDialogOpen, setPendingDialogOpen] = useState(false);

    return (
        <>
            <Head>
                <title>Kafet</title>
                <meta name="description" content="Kafet App" />
            </Head>

            <main>
                <PageLayout title={'Kafet'}>
                    {staffs === undefined
                        ? <LoadingScreen />
                        : <>
                            <FullHeightScrollableContainer sx={{ position: 'relative' }}>
                                <>
                                    <Typography variant="h5" m={1}>Staffs</Typography>
                                    <StaffList staffs={staffs} />
                                    {staff?.isAdmin &&
                                        <Fab
                                            onClick={() => setPendingDialogOpen(true)}
                                            color="primary"
                                            sx={{
                                                position: 'absolute',
                                                bottom: 16,
                                                right: 16,
                                            }}>
                                            <Add />
                                        </Fab>
                                    }
                                </>
                            </FullHeightScrollableContainer>

                            {staff?.isAdmin &&
                                <PendingStaffsDialog open={pendingDialogOpen} onClose={() => setPendingDialogOpen(false)} />
                            }
                        </>
                    }
                </PageLayout>
            </main>
        </>
    );
};

export default StaffPage;
