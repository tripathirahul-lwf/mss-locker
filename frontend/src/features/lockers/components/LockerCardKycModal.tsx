import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {allocationApi} from '../../allocations/api/allocationApi';
import {customerApi} from '../../customers/api/customerApi';
import {usePermission} from '../../../hooks/usePermission';
import {lockBodyScroll} from '../../../utils/bodyScrollLock';
import {LockerKycModal} from './LockerKycModal';
export function LockerCardKycModal({lockerId,onClose}:{lockerId:string;onClose:()=>void}) {
 const [busy,setBusy]=useState(false);
 const canView=usePermission('customers.kyc.view'),canViewAllocation=usePermission('allocations.view');
 useEffect(()=>lockBodyScroll(),[]);
 const allocation=useQuery({queryKey:['locker-allocations',lockerId],queryFn:()=>allocationApi.getLockerAllocations(lockerId),enabled:canView&&canViewAllocation});
 const tenant=allocation.data?.currentAllocation?.customerId;
 const documents=useQuery({queryKey:['customer-kyc',tenant?._id],queryFn:()=>customerApi.getKycDocuments(tenant!._id),enabled:canView&&canViewAllocation&&Boolean(tenant?._id)});
 return <LockerKycModal busy={busy} onClose={()=>{if(!busy)onClose();}} customerId={tenant?._id} customerName={tenant?.fullName} customerCode={tenant?.customerCode} kycStatus={tenant?.kycStatus} documents={documents.data||[]} loading={allocation.isLoading||documents.isLoading} failed={!canView||!canViewAllocation||allocation.isError||documents.isError} onBusyChange={setBusy} onRetry={()=>{if(!canView||!canViewAllocation)return;void allocation.refetch();if(tenant?._id)void documents.refetch();}}/>;
}
