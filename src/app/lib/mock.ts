import type {
  AuditLogEntry,
  FloatLedgerEntry,
  PosDeviceEvent,
  ReconciliationRun,
  Remittance,
  ReportRecord,
  User,
  Fine,
  Location,
  Ticketer_Location_Assignment,
  Float_Alocation,
  AddTopUp,
  Commission_Rate,
  Sales_Record,
  PosDevice
} from '@/types/types';
import { makeId} from './utils';


const now = new Date();
const iso  = now.toLocaleString("en-US", { month: "short" }) + now.getDate() + "/" + now.getFullYear();

// 788893988iuiuie9894

export const mockUsers: User[] = [
  {
     user_id: '1234562890',
     fullname: 'Aimuan ThankGod',
     guarantor: 'John Doe',
     guarantor_phone: '1234567890884',
     guarantor_address: '123 Main St',
     role:"TICKETER",
     created_at: iso,

     address: '123 Main St',
     phone: '12345678958550',
     email: 'cimessdev@gmail.com',
     supervisor: 'Idowu Otolorin',
  },
  {
     user_id: '1234561890',
     fullname: 'Esther John',
     guarantor: 'aliyu john',
     guarantor_phone: '1234567844290',
     guarantor_address: '123 Main St olodo , ijegun , egbeda',
     role: "TICKETER",
     created_at: iso,

     address: '123 iyana ipaja road',
     phone: '12345678442290',
     email: 'esther@gmail.com',
     supervisor: 'idowu Otolorin',
  },

  {
     user_id: '1234567490',
     fullname: 'Tunde Lawal',
     guarantor: 'sanni lawal',
     guarantor_phone: '123456229927890',
     guarantor_address: '123 Ayobo road',
     role: "TICKETER",
     created_at: iso,

     address: '123 ipaja road',
     phone: '123456720028890',
     email: 'tunde@gmail.com',
     supervisor: 'Idowu Otolorin',
  },
    {
     user_id: '1234562490',
     fullname: 'korede Adekunle',
     guarantor: 'adekunle',
     guarantor_phone: '12345277567890',
     guarantor_address: '123 ipaja road',
     role: "TICKETER",
     created_at: iso,

     address: '123 ipaja road',
     phone: '12345488467890',
     email: 'korede@gmail.com',
     supervisor: 'Raheed Abiodun',
  },
    {
     user_id: '1234564388490',
     fullname: 'Wale Adekunle',
     guarantor: 'taiye adekunle',
     guarantor_phone: '1234564iii47890',
     guarantor_address: '123 oshodi road',
     role: "TICKETER",
     created_at: iso,

     address: '123 ipaja road',
     phone: '12344884567890',
     email: 'wale@gmail.com',
     supervisor: 'Raheed Abiodun',
  },
    {
     user_id: '1234564390',
     fullname: 'Segun Bulala',
     guarantor: 'taiye adekunle',
     guarantor_phone: '123456777884890',
     guarantor_address: '123 oshodi road',
     role: "TICKETER",
     created_at: iso,

     address: '123 ipaja road',
     phone: '1234567884890',
     email: 'wale@gmail.com',
     supervisor: 'Raheed Abiodun',
  },

    {
     user_id: '12345884864390',
     fullname: 'Idowu Otolorin',
     guarantor: 'Sade Otolorin',
     guarantor_phone: '12345674uu4890',
     guarantor_address: '123 opeki road',
     role: "SUPERVISOR",
     created_at: iso,
     address: '123 ipaja road',
     phone: '123453883447890',
     email: 'idowu@gmail.com',
  },
    {
     user_id: '1234562780',
     fullname: 'Raheed Abiodun',
     guarantor: 'taiye adekunle',
     guarantor_phone: '1234u4uu4567890',
     guarantor_address: '123 badagry road',
     role: "SUPERVISOR",
     created_at: iso,
     address: '123 ipaja road',
     phone: '1234567890',
     email: 'raheed@gmail.com',
  },
   {
     user_id: '1234237890',
     fullname: 'Hassan Saheed',
     role: "ADMIN",
     created_at: iso,
     address: '123 Main St',
     phone: '1234563939397890',
     email: 'hassan@gmail.com',
     guarantor: null,
     guarantor_phone: null,
     guarantor_address: null,
  },

]


export const mockPosDevices: PosDevice[] = [
  {
    id: "788893988iuiuie9894",
    serial_number: "POS-AX12",
    name:"Diya",
    status: 'ACTIVE',
    created_at: iso,
  },
  {
    id: "78877473394",
    name:"Oluwa",
    serial_number: "POS-BB77",
    status: 'INACTIVE',
    created_at: iso,
  }, {
    id: "7888939883992839894",
    name:"Tunde",
    serial_number: "POS-AX11",
    status: 'ACTIVE',
    created_at: iso,
  }, {
    id: "7888939887727729894",
    name:"Korede",
    serial_number: "POS-AX10",
    status: 'ACTIVE',
    created_at: iso,
  }, {
    id: "78889398877277288298948",
    name:"Wale",
    serial_number: "POS-AX09",
    status: 'ACTIVE',
    created_at: iso,
  }, {
    id: "788893988772772882989472",
    serial_number: "POS-AX08",
    name:"Raheed",
    status: 'ACTIVE',
    created_at: iso,
  }, {
    id: "7888939887727728829893221432",
    serial_number: "POS-AX05",
    name:"Hassan",
    status: 'INACTIVE',
    created_at: iso,
  }, {
    id: "78889398877277288298943432",
    serial_number: "POS-AX04",
    name:"Idowu",
    status: 'MAINTENANCE',
    created_at: iso,
  }, {
    id: "788893988772772882989432",
    serial_number: "POS-AX03",
    name:"Esther",
    status: 'MAINTENANCE',
    created_at: iso,
  },  {
    id: "7888939887727728829894",
    serial_number: "POS-AX06",
    name:"Ope",
    status: 'INACTIVE',
    created_at: iso,
  },
]

export const mockPosEvents: PosDeviceEvent[] = [
  {         
  id:mockPosDevices[0].id,
  user_id:mockUsers[0].user_id,
  username:mockUsers[0].fullname,
  assigned_at:iso,
  assigned_by:mockUsers[6].user_id,
  status:'ACTIVE'
  },
  {
  id:mockPosDevices[1].id,
  user_id:mockUsers[1].user_id,
  username:mockUsers[1].fullname,
  assigned_at:iso,
  assigned_by:mockUsers[6].user_id,
  status:'ACTIVE'
  },
    {
  id:mockPosDevices[2].id,
  user_id:mockUsers[2].user_id,
  username:mockUsers[2].fullname,
  assigned_at:iso,
  assigned_by:mockUsers[6].user_id,
  status:'ACTIVE'
  },
    {
  id:mockPosDevices[3].id,
  user_id:mockUsers[3].user_id,
  username:mockUsers[3].fullname,
  assigned_at:iso,
  assigned_by:mockUsers[7 ].user_id,
  status:'ACTIVE'
  },
    {
  id:mockPosDevices[4].id,
  user_id:mockUsers[4].user_id,
  username:mockUsers[4].fullname,
  assigned_at:iso,
  assigned_by:mockUsers[7].user_id,
  status:'ACTIVE'
  },
    {
  id:mockPosDevices[5].id,
  user_id:mockUsers[5].user_id,
  username:mockUsers[5].fullname,
  assigned_at:iso,
  assigned_by:mockUsers[7].user_id,
  status:'ACTIVE'
  },
];


export const mockLocations: Location[] = [
  {
    id: "788898999221234566543294",
    name: 'Oshodi',
    address: '123 Main St',
    created_at: iso,
  },
  {
    id: "788889882894",
    name: 'abulegba',
    address: '123 Main St',
    created_at: iso,
  },
  {
    id: "78888119894",
    name: 'kola',
    address: '123 Main St',
    created_at: iso,
  },
   {
    id: "78888n99eb9894",
    name: 'gate',
    address: '123 Main St',
    created_at: iso,
  },
   {
    id: "788893988mnbvc9894",
    name: 'ikorodu',
    address: '123 Main St',
    created_at: iso,
  },
   {
    id: "788893mnm9889894",
    name: 'megida',
    address: '123 Main St',
    created_at: iso,
  }
]

export const mockRemittances: Remittance[] = [
{
    remit_id: "88487783464",
    method: "TRANSFER",
    amount: 12500,
    status: 'VERIFIED',
    submitted_at: iso,
    submitted_by: mockUsers[6].fullname,
    created_at: iso,
    
  },
   {
    remit_id: "2277665544",
    method: "TRANSFER",
    amount: 120500,
    status: 'VERIFIED',
    submitted_at: iso,
    submitted_by: mockUsers[1].fullname,
    created_at: iso,
  },  {
    remit_id: "78888989499966",
    method: "CASH",
    amount: 400000,
    status: 'VERIFIED',
    submitted_at: iso,
    submitted_by: mockUsers[2].fullname,
    created_at: iso,
  },  {
    remit_id: "uyyuweuywe88362",
    method: 'CASH',
    amount: 1200000,
    status: 'VERIFIED',
    submitted_at: iso,
    submitted_by: mockUsers[8].fullname,
    created_at: iso,
  },
  {
    remit_id: "uyyuweuuyuyuy34ywe",
    method: 'TRANSFER',
    amount: 120500,
    status: 'VERIFIED',
    submitted_at: iso,
    submitted_by: mockUsers[1].fullname,
    created_at: iso,
  }
   
];

export const mockReconciliationRuns: ReconciliationRun[] = [
  {
    run_id: "884",
    scope: "TICKETER",
    date: iso,
    expected_float: 12500,
    actual_remittance: 12500,
    variance: 0,
    status: 'MATCHED',
    generated_at: iso,
    actor: mockUsers[6].fullname,
  },
   {
    run_id: "22",
    scope: "TICKETER",
    date: iso,
    expected_float: 120500,
    actual_remittance: 120000,
    variance: -500,
    status: 'INVESTIGATING',
    generated_at: iso,
    actor: mockUsers[1].fullname,
  },  {
    run_id: "788889894",
    scope: "TICKETER",
    date: iso,
    expected_float: 400000,
    actual_remittance: 400000,
    variance: 0,
    status: 'MATCHED',
    generated_at: iso,
    actor: mockUsers[2].fullname,
  },  {
    run_id: "uyyuweuywe",
    scope: 'ADMIN',
    date: iso,
    expected_float: 1200000,
    actual_remittance: 1199500,
    variance: -500,
    status: 'VARIANCE',
    generated_at: iso,
    actor: mockUsers[8].fullname,
  },
  {
    run_id: "uyyuweuuyuyuy34ywe",
    scope: "TICKETER",
    date: iso,
    expected_float: 120500,
    actual_remittance: 120500,
    variance: 0,
    status: 'RESOLVED',
    generated_at: iso,
    actor: mockUsers[1].fullname,
  }
   
];

export const mockTopUps: AddTopUp[] = [
  {
    id: "55555",
    amount: 2500000,
    allocated_from: "GOVERNMENT_TOP_UP",
    allocationNote: "",
    company_float_id: "",
  },

];

export const mockFloatAllocation: Float_Alocation[] = [
    {
    id: "78889422111",
    from_user: mockUsers[8].fullname,
    to_user: mockUsers[7].fullname,
    top_up_id: mockTopUps[0].id,
    from_role: mockUsers[8].role,
    to_role: mockUsers[7].role,
    amount_allocated: 1000000,
    amount_remaining: 1500000,
    allocated_at: iso,
    status: 'SUCCESS',    
  },
    {
    id: "78889444555",
    from_user: mockUsers[8].fullname,
    to_user: mockUsers[6].fullname,
    top_up_id: mockTopUps[0].id,
    from_role: mockUsers[8].role,
    to_role: mockUsers[6].role,
    amount_allocated: 1000000,
    amount_remaining: 500000,
    allocated_at: iso,
    status: 'SUCCESS',    
  },
  {
    id: "788894112223",
    from_user: mockUsers[6].fullname,
    to_user: mockUsers[0].fullname,
    top_up_id: mockTopUps[0].id,
    amount_allocated: 350000,
    from_role: mockUsers[6].role,
    to_role: mockUsers[0].role,
    amount_remaining: 650000,
    allocated_at: iso,
    status: 'SUCCESS',    
  },
    {
    id: "784551114",
    from_user: mockUsers[6].fullname,
    to_user: mockUsers[1].fullname,
    top_up_id: mockTopUps[0].id,
    from_role: mockUsers[6].role,
    to_role: mockUsers[1].role,
    amount_allocated: 250000,
    amount_remaining: 400000,
    allocated_at: iso,
    status: 'SUCCESS',    
  },
    {
    id: "7885889",
    from_user: mockUsers[6].fullname,
    to_user: mockUsers[2].fullname,
    top_up_id: mockTopUps[0].id,
    amount_allocated: 300000,
    from_role: mockUsers[6].role,
    to_role: mockUsers[2].role,
    amount_remaining: 200000,
    allocated_at: iso,
    status: 'SUCCESS',    
  },
    {
    id: "7888322",
    from_user: mockUsers[7].fullname,
    to_user: mockUsers[3].fullname,
    top_up_id: mockTopUps[0].id,
    from_role: mockUsers[7].role,
    to_role: mockUsers[3].role,
    amount_allocated: 250000,
    amount_remaining: 750000,
    allocated_at: iso,
    status: 'SUCCESS',    
  },
    {
    id: "782114999922",
    from_user: mockUsers[7].fullname,
    to_user: mockUsers[4].fullname,
    top_up_id: mockTopUps[0].id,
    from_role: mockUsers[7].role,
    to_role: mockUsers[4].role,
    amount_allocated: 250000,
    amount_remaining: 500000,
    allocated_at: iso,
    status: 'SUCCESS',    
  },
   {
    id: "782114",
    from_user: mockUsers[7].fullname,
    to_user: mockUsers[5].fullname,
    top_up_id: mockTopUps[0].id,
    from_role: mockUsers[7].role,
    to_role: mockUsers[5].role,
    amount_allocated: 250000,
    amount_remaining: 250000,
    allocated_at: iso,
    status: 'SUCCESS',    
  }
  
]

export const mockFloatLedger: FloatLedgerEntry[] = [
  {
    id: "788894883383",
    user: mockUsers[8].fullname,
    amount: 1000000,
    entry_type: "DEBIT",
    description: `Float allocation to ${mockUsers[6].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },
    {
    id: "78889477221",
    user: mockUsers[8].fullname,
    amount: 1000000,
    entry_type: "DEBIT",
    description: `Float allocation to ${mockUsers[7].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },
  

    {
    id: "7888942992",
    user: mockUsers[6].fullname,
    amount: 1000000,
    entry_type: "CREDIT",
    description: `Float allocation to ${mockUsers[6].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },
    {
    id: "788894399330028",
    user: mockUsers[7].fullname,
    amount: 1000000,
    entry_type: "CREDIT",
    description: `Float allocation to ${mockUsers[7].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },


   {
    id: "78882211948833",
    user: mockUsers[6].fullname,
    amount: 350000,
    entry_type: "DEBIT",
    description: `Float allocation to ${mockUsers[0].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },
    {
    id: "7888948833",
    user: mockUsers[6].fullname,
    amount: 250000,
    entry_type: "DEBIT",
    description: `Float allocation to ${mockUsers[1].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },
    {
    id: "788894883",
    user: mockUsers[6].fullname,
    amount: 300000,
    entry_type: "DEBIT",
    description: `Float allocation to ${mockUsers[2].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },


   {
    id: "78889332248883",
    user: mockUsers[0].fullname,
    amount: 350000,
    entry_type: "CREDIT",
    description: `Float allocation to ${mockUsers[0].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },
    {
    id: "7888948883",
    user: mockUsers[1].fullname,
    amount: 250000,
    entry_type: "CREDIT",
    description: `Float allocation to ${mockUsers[1].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },
    {
    id: "7888947782",
    user: mockUsers[2].fullname,
    amount: 300000,
    entry_type: "CREDIT",
    description: `Float allocation to ${mockUsers[2].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  }
   ,
  
   {
    id: "7888948882",
    user: mockUsers[7].fullname,
    amount: 250000,
    entry_type: "DEBIT",
    description: `Float allocation to ${mockUsers[3].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },
    {
    id: "7888942622",
    user: mockUsers[7].fullname,
    amount: 250000,
    entry_type: "DEBIT",
    description: `Float allocation to ${mockUsers[4].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },
    {
    id: "78889488229",
    user: mockUsers[7].fullname,
    amount: 250000,
    entry_type: "DEBIT",
    description: `Float allocation to ${mockUsers[5].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },

  {
    id: "788894773",
    user: mockUsers[3].fullname,
    amount: 250000,
    entry_type: "CREDIT",
    description: `Float allocation to ${mockUsers[3].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },

    {
    id: "7888999934",
    user: mockUsers[4].fullname,
    amount: 250000,
    entry_type: "CREDIT",
    description: `Float allocation to ${mockUsers[4].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  },
    {
    id: "7888929924",
    user: mockUsers[5].fullname,
    amount: 250000,
    entry_type: "CREDIT",
    description: `Float allocation to ${mockUsers[5].fullname}`,
    created_at: "2023-10-10T10:00:00Z"
  }


];

export const mockSalesRecords: Sales_Record[] = [

  {
    id: "788893988iuiu266ie9894",
    ticketer_id: mockUsers[0].user_id,
    user_name: mockUsers[0].fullname,
    pos_session_id: mockPosEvents[0].id,
    location_id: mockLocations[0].id,
    opening_balance: 0,
    closing_balance: 0,
    top_up: 320000,
    total_sold: 320000,
    report_date: iso,
    submitted_at: iso,
  },
  {
    id: "788893988iuiuie9929894",
    ticketer_id: mockUsers[1].user_id,
    user_name: mockUsers[1].fullname,
    pos_session_id: mockPosEvents[1].id,
    location_id: mockLocations[1].id,
    opening_balance: 0,
    closing_balance: 0,
    top_up: 250000,
    total_sold: 250000,
    report_date: iso,
    submitted_at: iso,
  },
  {
    id: "78889398001238iuiuie9894",
    ticketer_id: mockUsers[2].user_id,
    user_name: mockUsers[2].fullname,
    pos_session_id: mockPosEvents[2].id,
    location_id: mockLocations[2].id,
    opening_balance: 0,
    closing_balance: 0,
    top_up: 300000,
    total_sold: 300000,
    report_date: iso,
    submitted_at: iso,
  },
  {
    id: "788893988iui882uie9894",
    ticketer_id: mockUsers[3].user_id,
    user_name: mockUsers[3].fullname,
    pos_session_id: mockPosEvents[3].id,
    location_id: mockLocations[3].id,
    opening_balance: 0,
    closing_balance: 0,
    top_up: 250000,
    total_sold: 250000,
    report_date: iso,
    submitted_at: iso,
  },
  {
    id: "78889398800000iuiuie9894",
    ticketer_id: mockUsers[4].user_id,
    user_name: mockUsers[4].fullname,
    pos_session_id: mockPosEvents[4].id,
    location_id: mockLocations[4].id,
    opening_balance: 0,
    closing_balance: 0,
    top_up: 250000,
    total_sold: 250000,
    report_date: iso,
    submitted_at: iso,
  },
   {
    id: "788893984481118339894",
    ticketer_id: mockUsers[4].user_id,
    user_name: mockUsers[4].fullname,
    pos_session_id: mockPosEvents[4].id,
    location_id: mockLocations[4].id,
    opening_balance: 0,
    closing_balance: 50000,
    top_up: 250000,
    total_sold: 200000,
    report_date: iso,
    submitted_at: iso,
  },
  {
    id: "788893988222iuiuie9894",
    ticketer_id: mockUsers[5].user_id,
    user_name: mockUsers[5].fullname,
    pos_session_id: mockPosEvents[5].id,
    location_id: mockLocations[5].id,
    opening_balance: 0,
    closing_balance: 0,
    top_up: 250000,
    total_sold: 250000,
    report_date: iso,
    submitted_at: iso,
  }
]

export const mockCommisionRules: Commission_Rate[] = [
  {
    id: "788893988iuiu33ie9894",
    role: 'TICKETER',
    percentage: 0.006,
    fixed_amount: 0,
    created_at: iso,
  },
  {
    id: "788893988iuiui333e9894",
    role: 'SUPERVISOR',
    percentage: 0.004,
    fixed_amount: 0,
    created_at: iso,
  },
  {
    id: "788893988iuiui44444e9894",
    role: 'ADMIN',
    percentage: 0.02,
    fixed_amount: 0,
    created_at: iso,
  },
  {
    id: "788893988iuiu6666ie9894",
    role: 'AUDITOR',
    percentage: 0.001,
    fixed_amount: 0,
    created_at: iso,
  }
]
  

export const mockTicketer_Location_Assignments: Ticketer_Location_Assignment[] = [
  {
    id: "788893988iui2222111uie9894",
    user_id: mockUsers[0].user_id,
    location_id: mockLocations[0].id,
    assigned_for: iso,
    created_at: iso,
  },
  {
    id: "78,mnh88939889894",
    user_id: mockUsers[1].user_id,
    location_id: mockLocations[1].id,
    assigned_for: iso,
    created_at: iso,
  },
  {
    id: "788893,m9889894",
    user_id: mockUsers[2].user_id,
    location_id: mockLocations[2].id,
    assigned_for: iso,
    created_at: iso,
  },
  {
    id: "78889398cxds89894",
    user_id: mockUsers[3].user_id,
    location_id: mockLocations[3].id,
    assigned_for: iso,
    created_at: iso,
  },
  {
    id: "7888939hgjk889894",
    user_id: mockUsers[4].user_id,
    location_id: mockLocations[4].id,
    assigned_for: iso,
    created_at: iso,
  },
  {
    id: makeId('assign'),
    user_id: mockUsers[5].user_id,
    location_id: mockLocations[5].id,
    assigned_for: iso,
    created_at: iso,
  }

]


export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: "7888939889ikj894",
    action: 'FLOAT_ALLOCATED',
    entity_type: 'float_ledger',
    entity_id: mockFloatLedger[1].id,
    actor: 'SUP_004',
    created_at: mockFloatLedger[1].created_at,
    meta: { ip: '10.0.0.12', device: 'web' },
    before: { ticketer_balance: 0 },
    after: { ticketer_balance: 50000 },
  },
  {
    id: makeId('audit'),
    action: 'REMITTANCE_SUBMITTED',
    entity_type: 'remittances',
    entity_id: mockRemittances[0].remit_id,
    actor: 'TIC_112',
    created_at: mockRemittances[0].submitted_at,
    meta: { ip: '10.0.0.44', device: 'mobile-web' },
  },
{
    id: makeId('audit'),
    action: 'REMITTANCE_SUBMITTED',
    entity_type: 'remittances',
    entity_id: mockRemittances[0].remit_id,
    actor: 'TIC_112',
    created_at: mockRemittances[0].submitted_at,
    meta: { ip: '10.0.0.44', device: 'mobile-web' },

}, 
{   id: makeId('audit'),
    action: 'REMITTANCE_SUBMITTED',
    entity_type: 'remittances',
    entity_id: mockRemittances[0].remit_id,
    actor: 'TIC_112',
    created_at: mockRemittances[0].submitted_at,
    meta: { ip: '10.0.0.44', device: 'mobile-web' },
},
{    id: "883662",
    action: 'REMITTANCE_SUBMITTED',
    entity_type: 'remittances',
    entity_id: mockRemittances[0].remit_id,
    actor: 'TIC_112',
    created_at: mockRemittances[0].submitted_at,
    meta: { ip: '10.0.0.44', device: 'mobile-web' },
}
]

export const mockReports: ReportRecord[] = [
  {
    report_id: "78889398897788894",
    name: 'Daily Reconciliation Summary',
    period: iso,
    status: 'READY',
    created_at: iso,
    created_by: 'svc.reports',
  },
  {
    report_id: "5",
    name: 'Outstanding Remittances',
    period: iso,
    status: 'RUNNING',
    created_at: iso,
    created_by: 'management:MGT_02',
  },
];

export const mockFines: Fine[] = [
  {
  id: "788893988644559894",
  amount: 5000,
  reason: 'Late remittance',
  issued_by: mockUsers[7].fullname,
  status: 'UNPAID',
  defaulter_id: mockUsers[1].user_id,
  created_at: iso,

  },
  {
  id: "iuiuhj",
  amount:1000,
  reason: 'Late remittance',
  issued_by: mockUsers[7].fullname,
  status: 'UNPAID',
  defaulter_id: mockUsers[1].user_id,
  created_at: iso,

  }
]
