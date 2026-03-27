"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { TeacherApiService } from "@/services/teacher-api.service";
import { getCurrentAcademicYearBE, getAcademicYearOptions } from "@/features/student/academic-term";

export function DailyHealthFeature({ session }: { session: any }) {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [classLevel, setClassLevel] = useState("มัธยมศึกษาปีที่ 1");
    const [year, setYear] = useState(getCurrentAcademicYearBE());
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [semester, setSemester] = useState<string | number>(1);
    const [advisorClasses, setAdvisorClasses] = useState<any[]>([]);
    const [isAdvisor, setIsAdvisor] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    const [recordDate, setRecordDate] = useState('');
    const [dailyHealth, setDailyHealth] = useState<Record<number, { drinks_milk: boolean; brushes_teeth: boolean }>>({});

    useEffect(() => {
        setRecordDate(new Date().toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [yearsData, classes] = await Promise.all([
                    TeacherApiService.getAcademicYears(),
                    TeacherApiService.getAdvisorClasses(session.id)
                ]);

                setAdvisorClasses(classes || []);
                setIsAdvisor((classes || []).length > 0);
                if ((classes || []).length > 0) {
                    setClassLevel(classes[0].class_level);
                }

                const dbYearNums = (yearsData || []).map((y: any) => parseInt(y.year_name));
                const defaultYears = getAcademicYearOptions(getCurrentAcademicYearBE(), 5);
                const combined = Array.from(new Set([...dbYearNums, ...defaultYears])).sort((a, b) => b - a);
                const merged = combined.map(yNum => {
                    const dbMatch = yearsData?.find((dy: any) => parseInt(dy.year_name) === yNum);
                    return {
                        id: dbMatch?.id || `fallback-${yNum}`,
                        year_name: yNum.toString(),
                        is_active: dbMatch?.is_active || false
                    };
                });
                setAcademicYears(merged);
                const active = merged.find((y: any) => y.is_active);
                if (active) setYear(parseInt(active.year_name));
            } catch (e) {
                console.error("Failed to fetch initial data", e);
                setIsAdvisor(false);
            }
        };
        fetchData();
    }, [session.id]);

    const loadStudents = async () => {
        setLoading(true);
        setHasSearched(true);
        try {
            const data = await TeacherApiService.getFitnessStudents(session.id, classLevel, "", year, semester);
            setStudents(data || []);
        } catch (e: any) {
            toast.error(e?.message || "โหลดข้อมูลนักเรียนไม่สำเร็จ");
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };

    const loadDailyHealth = async (studentList: any[]) => {
        if (studentList.length === 0) return;
        try {
            const sem = typeof semester === 'number' ? semester : 1;
            const ids = studentList.map((s: any) => s.id);
            const records = await TeacherApiService.getDailyHealthRecords(ids, year, sem, recordDate, session.id);
            const map: Record<number, { drinks_milk: boolean; brushes_teeth: boolean }> = {};
            studentList.forEach((s: any) => {
                map[s.id] = { drinks_milk: false, brushes_teeth: false };
            });
            (records || []).forEach((r: any) => {
                map[r.student_id] = {
                    drinks_milk: !!r.drinks_milk,
                    brushes_teeth: !!r.brushes_teeth
                };
            });
            setDailyHealth(map);
        } catch (e) {
            console.error("Failed to load daily health records", e);
        }
    };

    useEffect(() => {
        if (students.length > 0 && hasSearched) {
            loadDailyHealth(students);
        }
    }, [students, recordDate]);

    const handleCancel = () => {
        setHasSearched(false);
        setStudents([]);
        setDailyHealth({});
    };

    const handleSaveAll = async () => {
        if (students.length === 0) {
            toast.error("กรุณาค้นหานักเรียนก่อนบันทึก");
            return;
        }
        setSaving(true);
        try {
            const sem = typeof semester === 'number' ? semester : 1;
            const savePromises = students.map(s => {
                const dh = dailyHealth[s.id] || { drinks_milk: false, brushes_teeth: false };
                return TeacherApiService.saveDailyHealthRecord({
                    student_id: s.id,
                    year,
                    semester: sem,
                    record_date: recordDate,
                    drinks_milk: dh.drinks_milk,
                    brushes_teeth: dh.brushes_teeth,
                    recorded_by: session.id,
                });
            });
            await Promise.all(savePromises);
            toast.success(`บันทึกเรียบร้อย ${students.length} รายการ`, { duration: 3000 });
        } catch (e: any) {
            toast.error(e?.message || "บันทึกข้อมูลไม่สำเร็จ", { duration: 4000 });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-sky-500 to-indigo-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Daily Health</div>
                    <h1 className="text-3xl font-bold">บันทึกการกินนมและการแปรงฟัน</h1>
                    <p className="text-sky-100 mt-2">บันทึกข้อมูลการดื่มนมและการแปรงฟันประจำวันของนักเรียน</p>
                </div>
            </section>

            <div className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end transition-opacity ${!isAdvisor ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">ชั้น</label>
                    <select className="px-4 py-2 border border-slate-200 rounded-xl outline-none min-w-[140px]" value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
                        {advisorClasses.map(c => c.class_level).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).map((l: string) => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">ปีการศึกษา</label>
                    <select className="px-4 py-2 border border-slate-200 rounded-xl outline-none w-32" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                        {academicYears.length > 0 ? (
                            academicYears.map((y: any) => (
                                <option key={y.id} value={parseInt(y.year_name)}>{y.year_name}</option>
                            ))
                        ) : (
                            <option value={year}>{year}</option>
                        )}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">ภาค</label>
                    <select className="px-4 py-2 border border-slate-200 rounded-xl outline-none" value={semester} onChange={(e) => setSemester(e.target.value === "all" ? "all" : Number(e.target.value))}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">วันที่</label>
                    <input
                        type="date"
                        className="px-4 py-2 border border-slate-200 rounded-xl outline-none min-w-[160px]"
                        value={recordDate}
                        onChange={(e) => setRecordDate(e.target.value)}
                    />
                </div>
                <button
                    disabled={!isAdvisor}
                    onClick={loadStudents}
                    className="px-5 py-2 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 transition-colors shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    ค้นหา
                </button>
            </div>

            {isAdvisor === false && (
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-6 text-sky-800 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h3 className="font-bold text-lg">เฉพาะครูที่ปรึกษา</h3>
                        <p className="text-sky-700">คุณไม่สามารถบันทึกข้อมูลได้ เนื่องจากคุณไม่ได้เป็นครูที่ปรึกษาประจำชั้นใดๆ</p>
                    </div>
                </div>
            )}

            {loading && <div className="text-center py-8 text-slate-500">กำลังโหลด...</div>}
            {!loading && hasSearched && students.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border border-slate-200">ไม่พบนักเรียนในชั้น/ห้องที่เลือก</div>
            )}

            {!loading && students.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 w-16">เลขที่</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 w-32">รหัสนักเรียน</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 min-w-[200px]">ชื่อ-นามสกุล</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 w-32">
                                    <div className="flex flex-col items-center gap-1">
                                        <span>🥛 ดื่มนม</span>
                                        <button
                                            type="button"
                                            className="text-[10px] text-sky-600 hover:text-sky-800 font-bold"
                                            onClick={() => {
                                                const allChecked = students.every(s => dailyHealth[s.id]?.drinks_milk);
                                                const newMap = { ...dailyHealth };
                                                students.forEach(s => {
                                                    if (!newMap[s.id]) newMap[s.id] = { drinks_milk: false, brushes_teeth: false };
                                                    newMap[s.id].drinks_milk = !allChecked;
                                                });
                                                setDailyHealth(newMap);
                                            }}
                                        >
                                            {students.every(s => dailyHealth[s.id]?.drinks_milk) ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                                        </button>
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600 w-32">
                                    <div className="flex flex-col items-center gap-1">
                                        <span>🪥 แปรงฟัน</span>
                                        <button
                                            type="button"
                                            className="text-[10px] text-sky-600 hover:text-sky-800 font-bold"
                                            onClick={() => {
                                                const allChecked = students.every(s => dailyHealth[s.id]?.brushes_teeth);
                                                const newMap = { ...dailyHealth };
                                                students.forEach(s => {
                                                    if (!newMap[s.id]) newMap[s.id] = { drinks_milk: false, brushes_teeth: false };
                                                    newMap[s.id].brushes_teeth = !allChecked;
                                                });
                                                setDailyHealth(newMap);
                                            }}
                                        >
                                            {students.every(s => dailyHealth[s.id]?.brushes_teeth) ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                                        </button>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((s, i) => {
                                const dh = dailyHealth[s.id] || { drinks_milk: false, brushes_teeth: false };
                                return (
                                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-slate-500 text-center">{i + 1}</td>
                                        <td className="px-4 py-3 text-sm text-slate-500 text-center">{s.student_code}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm text-slate-800 font-semibold truncate max-w-[200px] xl:max-w-none" title={`${s.prefix}${s.first_name} ${s.last_name}`}>
                                                {s.prefix}{s.first_name} {s.last_name}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={!!dh.drinks_milk}
                                                    onChange={(e) => {
                                                        setDailyHealth(prev => ({
                                                            ...prev,
                                                            [s.id]: { ...(prev[s.id] || { drinks_milk: false, brushes_teeth: false }), drinks_milk: e.target.checked }
                                                        }));
                                                    }}
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                                            </label>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={!!dh.brushes_teeth}
                                                    onChange={(e) => {
                                                        setDailyHealth(prev => ({
                                                            ...prev,
                                                            [s.id]: { ...(prev[s.id] || { drinks_milk: false, brushes_teeth: false }), brushes_teeth: e.target.checked }
                                                        }));
                                                    }}
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                                            </label>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                        <button onClick={handleCancel} className="px-8 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors">
                            ยกเลิก
                        </button>
                        <button onClick={handleSaveAll} disabled={saving} className="px-8 py-2.5 bg-sky-600 text-white rounded-xl font-semibold hover:bg-sky-700 transition-colors disabled:opacity-50">
                            {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
