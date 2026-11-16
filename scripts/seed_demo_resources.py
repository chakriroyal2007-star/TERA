"""
Seed Script: Populates realistic fleet of ambulances, field responders,
and multi-specialty hospitals with complete departments, beds, and capabilities.
"""
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db import SessionLocal
from app.models import (
    Organization, User, Membership, Ambulance, Hospital, Department, Capacity, Mission
)
from app.security import passwords

def seed_resources():
    with SessionLocal() as db:
        print("🌱 Seeding comprehensive emergency fleet, responders, and hospitals...")

        # 1. Get or create organizations
        eoc_org = db.query(Organization).filter(Organization.name == "Emergency Operations Center").first()
        if not eoc_org:
            eoc_org = Organization(name="Emergency Operations Center")
            db.add(eoc_org)
            db.flush()

        hosp_org = db.query(Organization).filter(Organization.name == "City Emergency Hospital Network").first()
        if not hosp_org:
            hosp_org = Organization(name="City Emergency Hospital Network")
            db.add(hosp_org)
            db.flush()

        # 2. Mark old test missions as completed to free up previously locked resources
        stale_missions = db.query(Mission).filter(
            Mission.status.in_(["assigned", "acknowledged", "on_scene", "transporting"])
        ).all()
        for m in stale_missions:
            m.status = "completed"
        db.flush()
        print(f"✅ Cleared {len(stale_missions)} historical test missions to free fleet.")

        # 3. Seed 8 Ambulances with complete pilot and contact details
        ambulances_data = [
            ("TERA-AMB-01", "Advanced Life Support (ALS)", "Suresh Varma", "+91 98491 10801"),
            ("TERA-AMB-02", "Advanced Life Support (ALS)", "Ramesh Kumar (Pilot)", "+91 98490 12345"),
            ("TERA-AMB-03", "Basic Life Support (BLS)", "K. Praveen", "+91 98492 10803"),
            ("TERA-AMB-04", "Critical Care Transport (CCT)", "M. Srinivas", "+91 98493 10804"),
            ("TERA-AMB-05", "Advanced Life Support (ALS)", "Abdul Rahim", "+91 98494 10805"),
            ("TERA-AMB-06", "Paediatric / Neonatal Unit", "T. Rajesh", "+91 98495 10806"),
            ("TERA-AMB-07", "Rapid Response Paramedic Unit", "Anil Sharma", "+91 98496 10807"),
            ("TERA-AMB-08", "Advanced Cardiac Life Support (ACLS)", "Vikram Reddy", "+91 98497 10808"),
        ]

        for reg, vtype, driver, phone in ambulances_data:
            amb = db.query(Ambulance).filter(Ambulance.registration == reg).first()
            if not amb:
                amb = Ambulance(
                    organization_id=eoc_org.id,
                    registration=reg,
                    vehicle_type=vtype,
                    driver_name=driver,
                    driver_phone=phone,
                    active=True,
                )
                db.add(amb)
            else:
                amb.vehicle_type = vtype
                amb.driver_name = driver
                amb.driver_phone = phone
                amb.active = True
        db.flush()
        print(f"✅ Verified {len(ambulances_data)} ambulances.")

        # 4. Seed 8 Field Responders
        responders_data = [
            ("responder@tera.org", "Rapid Responder Alpha", "+91 98491 11001"),
            ("responder2@tera.org", "Field Responder Bravo", "+91 98491 11002"),
            ("responder3@tera.org", "EMT Specialist Charlie", "+91 98491 11003"),
            ("responder4@tera.org", "Paramedic Lead David", "+91 98491 11004"),
            ("responder5@tera.org", "Trauma Paramedic Elena", "+91 98491 11005"),
            ("responder6@tera.org", "Cardiac EMT Farhan", "+91 98491 11006"),
            ("responder7@tera.org", "Critical Care EMT Gowri", "+91 98491 11007"),
            ("responder8@tera.org", "Field Paramedic Harish", "+91 98491 11008"),
        ]

        for email, name, phone in responders_data:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(
                    email=email,
                    name=name,
                    phone=phone,
                    password_hash=passwords.hash("Emergency@2025!"),
                    verified=True,
                    suspended=False,
                )
                u.role = "responder"
                u.organization_id = eoc_org.id
                db.add(u)
                db.flush()
            else:
                u.phone = phone
                u.verified = True
                u.suspended = False
                u.role = "responder"
                u.organization_id = eoc_org.id
        db.flush()
        print(f"✅ Verified {len(responders_data)} field responders.")

        # 5. Seed 6 Comprehensive Multi-Specialty Hospitals with full details and departments
        hospitals_data = [
            {
                "name": "City Central Emergency Hospital",
                "hospital_type": "Level-1 Apex Trauma Center",
                "phone": "+91 80 2299 1000",
                "emergency_phone": "112 / 108",
                "address": "100 Emergency Care Blvd, Sampangi Rama Nagar",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560001",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "specialties": ["Trauma care", "Surgery", "Cardiac care", "ICU", "Ventilator", "Blood bank", "Emergency trauma support", "ICU support"],
                "facilities": ["24/7 Trauma Bay", "Cath Lab", "Blood Bank", "CT/MRI Imaging", "Helipad Resuscitation"],
                "departments": [
                    ("Emergency & Resuscitation", [("icu", 25, 6, 2, 0), ("emergency", 40, 12, 3, 0)]),
                    ("Cardiology & CCU", [("icu", 15, 5, 1, 0), ("general", 20, 8, 2, 0)]),
                    ("Surgical Trauma", [("icu", 15, 4, 1, 0), ("emergency", 20, 6, 2, 0)]),
                ]
            },
            {
                "name": "Apollo Multi-Specialty Hospital",
                "hospital_type": "Apex Super-Specialty & Level-1 Trauma",
                "phone": "+91 80 2630 4050",
                "emergency_phone": "1066",
                "address": "154/11 Bannerghatta Road, Opp IIMB",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560076",
                "latitude": 12.8958,
                "longitude": 77.5992,
                "specialties": ["Trauma care", "Surgery", "Cardiac care", "ICU", "Ventilator", "Blood bank", "Burns treatment", "Neurology", "Emergency trauma support"],
                "facilities": ["Dedicated Burn ICU", "Advanced Stroke Center", "Organ Transplant Unit", "24/7 Dialysis", "Blood Bank"],
                "departments": [
                    ("Emergency Trauma Bay", [("emergency", 35, 10, 2, 0), ("icu", 20, 5, 2, 0)]),
                    ("Neuro & Spine Critical Care", [("icu", 16, 4, 1, 0), ("emergency", 12, 3, 1, 0)]),
                    ("Burns Care Unit", [("icu", 10, 2, 1, 0), ("general", 15, 4, 1, 0)]),
                ]
            },
            {
                "name": "Manipal Emergency & Trauma Center",
                "hospital_type": "Multi-Specialty Trauma Care & Orthopedics",
                "phone": "+91 80 2502 4444",
                "emergency_phone": "080-2502-3333",
                "address": "98 HAL Airport Road, Kodihalli",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560017",
                "latitude": 12.9592,
                "longitude": 77.6534,
                "specialties": ["Trauma care", "Surgery", "ICU", "Ventilator", "Blood bank", "Orthopedics", "Emergency trauma support", "ICU support"],
                "facilities": ["Polytrauma Resuscitation", "High-Velocity Collision Theater", "Blood Bank", "Robotic Surgical Bay"],
                "departments": [
                    ("Polytrauma & Emergency", [("emergency", 30, 8, 2, 0), ("icu", 18, 6, 2, 0)]),
                    ("Orthopedic Critical Care", [("general", 25, 9, 2, 0), ("icu", 10, 3, 1, 0)]),
                ]
            },
            {
                "name": "Fortis Healthcare Super-Specialty",
                "hospital_type": "Comprehensive Stroke & Cardiac Center",
                "phone": "+91 80 6621 4444",
                "emergency_phone": "105711",
                "address": "14 Cunningham Road, Vasanth Nagar",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560052",
                "latitude": 12.9868,
                "longitude": 77.5998,
                "specialties": ["Cardiac care", "Stroke care", "ICU", "Ventilator", "Neurology", "Blood bank", "Surgery"],
                "facilities": ["Rapid Stroke Thrombolysis Unit", "Emergency Cath Lab", "ECMO Support", "24/7 CCU"],
                "departments": [
                    ("Comprehensive Stroke Center", [("icu", 14, 4, 1, 0), ("emergency", 20, 6, 2, 0)]),
                    ("Cardiovascular Emergency", [("icu", 16, 5, 2, 0), ("general", 22, 7, 2, 0)]),
                ]
            },
            {
                "name": "Rainbow Children's Emergency Hospital",
                "hospital_type": "Paediatric Emergency & Neonatal Center",
                "phone": "+91 80 4241 2345",
                "emergency_phone": "080-4241-0000",
                "address": "Survey No. 8/5 Marathahalli - Sarjapur Road",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560037",
                "latitude": 12.9248,
                "longitude": 77.6749,
                "specialties": ["Paediatric emergency care", "Paediatric surgery", "NICU", "PICU", "Ventilator", "Blood bank"],
                "facilities": ["Level-4 NICU", "Paediatric Trauma Bay", "Dedicated Paediatric Ambulance Transfer", "Child Life Specialists"],
                "departments": [
                    ("Paediatric Emergency (ER)", [("emergency", 25, 6, 2, 0), ("icu", 18, 5, 2, 0)]),
                    ("Neonatal Critical Care (NICU)", [("icu", 22, 7, 2, 0), ("general", 15, 3, 1, 0)]),
                ]
            },
            {
                "name": "St. John's Medical College Hospital",
                "hospital_type": "Government-Affiliated Teaching Trauma Center",
                "phone": "+91 80 4946 6000",
                "emergency_phone": "080-2206-5000",
                "address": "Sarjapur Road, John Nagar, Koramangala",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560034",
                "latitude": 12.9344,
                "longitude": 77.6189,
                "specialties": ["Trauma care", "Surgery", "Burns treatment", "Blood bank", "ICU support", "Paediatric emergency care", "General emergency"],
                "facilities": ["Mass Casualty Triage Yard", "24/7 Red Cross Blood Bank", "Toxicology & Poison Control", "Burns Ward"],
                "departments": [
                    ("Central Emergency Casualty", [("emergency", 45, 14, 4, 0), ("icu", 25, 8, 3, 0)]),
                    ("Burns & Plastic Surgery ICU", [("icu", 12, 3, 1, 0), ("emergency", 15, 4, 2, 0)]),
                    ("General Medical Critical Care", [("general", 30, 10, 3, 0), ("icu", 15, 5, 2, 0)]),
                ]
            },
        ]

        for hdata in hospitals_data:
            h = db.query(Hospital).filter(Hospital.name == hdata["name"]).first()
            if not h:
                h = Hospital(
                    organization_id=hosp_org.id,
                    name=hdata["name"],
                    hospital_type=hdata["hospital_type"],
                    phone=hdata["phone"],
                    emergency_phone=hdata["emergency_phone"],
                    address=hdata["address"],
                    city=hdata["city"],
                    state=hdata["state"],
                    postal_code=hdata["postal_code"],
                    latitude=hdata["latitude"],
                    longitude=hdata["longitude"],
                    specialties=hdata["specialties"],
                    facilities=hdata["facilities"],
                    operating_status="Operational",
                    verification_status="approved",
                    diversion_status=False,
                )
                db.add(h)
                db.flush()
            else:
                h.phone = hdata["phone"]
                h.emergency_phone = hdata["emergency_phone"]
                h.address = hdata["address"]
                h.latitude = hdata["latitude"]
                h.longitude = hdata["longitude"]
                h.specialties = hdata["specialties"]
                h.facilities = hdata["facilities"]
                h.operating_status = "Operational"
                h.verification_status = "approved"
                h.diversion_status = False

            # Seed departments and capacities
            for dept_name, capacities in hdata["departments"]:
                dept = db.query(Department).filter(
                    Department.hospital_id == h.id, Department.name == dept_name
                ).first()
                if not dept:
                    dept = Department(hospital_id=h.id, name=dept_name, dept_type="Emergency")
                    db.add(dept)
                    db.flush()

                for kind, total, occ, res, oos in capacities:
                    cap = db.query(Capacity).filter(
                        Capacity.department_id == dept.id, Capacity.kind == kind
                    ).first()
                    if not cap:
                        cap = Capacity(
                            department_id=dept.id,
                            kind=kind,
                            total=total,
                            occupied=occ,
                            reserved=res,
                            out_of_service=oos,
                        )
                        db.add(cap)
                    else:
                        cap.total = total
                        cap.occupied = occ
                        cap.reserved = res
                        cap.out_of_service = oos

        db.commit()
        print("🎉 Successfully seeded 8 ambulances, 8 responders, and 6 premier multi-specialty hospitals with full capacities!")

if __name__ == "__main__":
    seed_resources()
