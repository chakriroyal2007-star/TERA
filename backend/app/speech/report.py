import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.units import inch


def generate_incident_pdf(
    incident,
    voice_recording=None,
    transcript=None,
    extraction=None,
    events=None,
    reports=None,
) -> bytes:
    """
    Generates a formal, database-backed PDF incident report.
    Clearly distinguishes original spoken audio/transcripts from extracted/confirmed fields.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
    )
    subtitle_style = ParagraphStyle(
        "DocSub",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#dc2626"),
        alignment=0,
    )
    heading_style = ParagraphStyle(
        "Heading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=10,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
    )
    bold_style = ParagraphStyle(
        "Bold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#0f172a"),
    )
    transcript_style = ParagraphStyle(
        "Transcript",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
    )

    story = []

    # Header / Branding
    story.append(Paragraph("TERA PLATFORM", subtitle_style))
    story.append(Paragraph("Emergency Incident & Voice Coordination Report", title_style))
    story.append(
        Paragraph(
            f"Report Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} | TERA Version 2.0",
            body_style,
        )
    )
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f172a"), spaceAfter=15))

    # Core Incident Overview Table
    inc_id = getattr(incident, "case_id", None) or incident.id.upper()
    cat = (incident.category or "").replace("_", " ").title()
    status = (incident.status or "").upper()
    priority = (incident.priority or "").upper()
    created = incident.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if incident.created_at else "N/A"
    lang = getattr(incident, "detected_language", None) or (transcript.detected_language if transcript else "en")
    lang_names = {"en": "English", "te": "Telugu", "hi": "Hindi", "ta": "Tamil", "ml": "Malayalam", "kn": "Kannada"}
    lang_display = f"{lang_names.get(lang, lang.upper())} ({lang})"

    info_data = [
        [
            Paragraph("<b>Case ID:</b>", body_style),
            Paragraph(f"<b>{inc_id}</b>", bold_style),
            Paragraph("<b>Status:</b>", body_style),
            Paragraph(status, bold_style),
        ],
        [
            Paragraph("<b>Category:</b>", body_style),
            Paragraph(cat, body_style),
            Paragraph("<b>Priority:</b>", body_style),
            Paragraph(priority, bold_style),
        ],
        [
            Paragraph("<b>Reported At:</b>", body_style),
            Paragraph(created, body_style),
            Paragraph("<b>Coordinates:</b>", body_style),
            Paragraph(f"{incident.latitude or 'N/A'}, {incident.longitude or 'N/A'}", body_style),
        ],
        [
            Paragraph("<b>Address / Location:</b>", body_style),
            Paragraph(incident.address or "N/A", body_style),
            Paragraph("<b>Language:</b>", body_style),
            Paragraph(lang_display, body_style),
        ],
    ]

    t_info = Table(info_data, colWidths=[1.4 * inch, 2.2 * inch, 1.2 * inch, 2.2 * inch])
    t_info.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(t_info)
    story.append(Spacer(1, 12))

    # Incident Description
    story.append(Paragraph("Incident Description", heading_style))
    story.append(Paragraph(incident.description or "No description provided.", body_style))
    story.append(Spacer(1, 10))

    # Voice Recording & Speech Transcription Section
    if voice_recording or transcript:
        story.append(Paragraph("Voice Recording & Speech-to-Text Pipeline", heading_style))

        voice_meta = [
            [
                Paragraph("<b>Audio Checksum (SHA-256):</b>", body_style),
                Paragraph(voice_recording.checksum if voice_recording else "N/A", body_style),
            ],
            [
                Paragraph("<b>Audio Format / Duration:</b>", body_style),
                Paragraph(
                    f"{voice_recording.mime_type if voice_recording else 'N/A'} | {voice_recording.duration if voice_recording else 0.0:.1f}s",
                    body_style,
                ),
            ],
            [
                Paragraph("<b>Speech Provider:</b>", body_style),
                Paragraph(transcript.provider if transcript else "N/A", body_style),
            ],
            [
                Paragraph("<b>Transcription Confidence:</b>", body_style),
                Paragraph(
                    f"{transcript.confidence * 100:.1f}%"
                    if (transcript and transcript.confidence is not None)
                    else "Confidence information not provided by speech provider.",
                    body_style,
                ),
            ],
        ]
        t_voice = Table(voice_meta, colWidths=[2.2 * inch, 4.8 * inch])
        t_voice.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(t_voice)
        story.append(Spacer(1, 8))

        if transcript and transcript.original_transcript:
            story.append(Paragraph("Original Spoken Transcript (Verbatim):", bold_style))
            story.append(Paragraph(f'"{transcript.original_transcript}"', transcript_style))
            story.append(Spacer(1, 6))

        eng_trans = getattr(incident, "english_translation", None) or (extraction.extracted_json.get("english_translation") if extraction and extraction.extracted_json else None)
        if eng_trans and eng_trans != (transcript.original_transcript if transcript else ""):
            story.append(Paragraph("English Translation (for Response Operations):", bold_style))
            story.append(Paragraph(f'"{eng_trans}"', body_style))
            story.append(Spacer(1, 6))

        if transcript and transcript.corrected_transcript:
            story.append(Paragraph("Reporter-Corrected Transcript:", bold_style))
            story.append(Paragraph(f'"{transcript.corrected_transcript}"', body_style))
            story.append(Spacer(1, 6))

        if extraction and extraction.extracted_json:
            ej = extraction.extracted_json
            story.append(Paragraph("Extracted Emergency Fields:", bold_style))
            ext_rows = [
                [
                    Paragraph("<b>Extracted Category:</b>", body_style),
                    Paragraph(str(ej.get("category", "N/A")), body_style),
                    Paragraph("<b>Extracted Severity:</b>", body_style),
                    Paragraph(str(ej.get("severity", "N/A")), body_style),
                ],
                [
                    Paragraph("<b>Extracted Location:</b>", body_style),
                    Paragraph(str(ej.get("location_text", "N/A")), body_style),
                    Paragraph("<b>People Affected:</b>", body_style),
                    Paragraph(str(ej.get("affected_people", "Not specified")), body_style),
                ],
                [
                    Paragraph("<b>Required Resources:</b>", body_style),
                    Paragraph(", ".join(ej.get("required_resources", [])) or "None specified", body_style),
                    Paragraph("<b>Safety Concerns:</b>", body_style),
                    Paragraph(str(ej.get("immediate_safety_concerns", "None noted")), body_style),
                ],
            ]
            t_ext = Table(ext_rows, colWidths=[1.5 * inch, 2.0 * inch, 1.5 * inch, 2.0 * inch])
            t_ext.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
                        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#fca5a5")),
                        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#fee2e2")),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            story.append(t_ext)
            story.append(Spacer(1, 10))

    # Operational Timeline History
    if events:
        story.append(Paragraph("Coordination Timeline & Audit Trail", heading_style))
        ev_data = [["Timestamp", "Action / Milestone", "Actor"]]
        for e in events[:15]:
            ts = e.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if getattr(e, "created_at", None) else "N/A"
            kind = getattr(e, "kind", "").replace(".", " ").replace("_", " ").title()
            actor = getattr(e, "actor_id", "System") or "System"
            ev_data.append([Paragraph(ts, body_style), Paragraph(kind, body_style), Paragraph(actor[:12], body_style)])

        t_events = Table(ev_data, colWidths=[2.2 * inch, 3.3 * inch, 1.5 * inch])
        t_events.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(t_events)

    # Footer note
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=6))
    story.append(
        Paragraph(
            "TERA 2.0 Coordination Platform · This electronic record was automatically generated from verified database records.",
            ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7, leading=9, textColor=colors.HexColor("#64748b")),
        )
    )

    doc.build(story)
    return buffer.getvalue()

