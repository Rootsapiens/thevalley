"""Tiny Blueprint-graph builder on top of UE 5.8's BlueprintGraphEditor (Python, editor only).

The project has no C++ toolchain, so the weapon and bot logic are Blueprints generated from Python: re-running a
make_* script empties the Blueprint in place and rebuilds it, so the graphs are reproducible and reviewable as Python.

  bp = new_bp("/Game/OmegaValley/Weapons/BP_X", unreal.Actor)
  var(bp, "Speed", "real", 2.5)
  g = event(bp, "ReceiveTick")              # cursor = the event's exec output
  with g.if_(g.gt(g.v("Speed"), 1.0)):
      g.s("Speed", g.mul(g.v("Speed"), 0.5))
  compile_bp(bp)

Values passed to pins: a Node / BlueprintGraphPin is wired; bool/int/float/str/V()/R() are literals.
Exec flow: every impure node is chained after the current cursor (a list of exec output pins, so branches re-join).
"""
import os

import unreal

L = unreal.BlueprintEditorLibrary
GE = unreal.BlueprintGraphEditor

MODULE = {"AIController": "AIModule", "AIBlueprintHelperLibrary": "AIModule", "NavigationSystemV1": "NavigationSystem",
          "NiagaraFunctionLibrary": "Niagara"}


TRACE = os.environ.get("OV_BP_TRACE") == "1"


def log(m):
    unreal.log("[OV BP] " + str(m))


def fpath(fn):
    if fn.startswith("/"):
        return fn
    cls = fn.split(".")[0]
    return "/Script/%s.%s" % (MODULE.get(cls, "Engine"), fn)


def _num(x):
    if isinstance(x, float):
        t = ("%.6f" % x).rstrip("0").rstrip(".")
        return t if t not in ("", "-0") else "0"
    return str(x)


class V(tuple):
    def lit(self):                      # pin default format
        return ",".join(_num(float(c)) for c in self)

    def var_lit(self):                  # variable default (ImportText) format
        return "(X=%s,Y=%s,Z=%s)" % tuple(_num(float(c)) for c in self)


class R(tuple):   # pitch, yaw, roll
    def lit(self):
        return ",".join(_num(float(c)) for c in self)

    def var_lit(self):
        return "(Pitch=%s,Yaw=%s,Roll=%s)" % tuple(_num(float(c)) for c in self)


def lit(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (V, R)):
        return v.lit()
    if isinstance(v, (int, float)):
        return _num(v)
    return str(v)


def T(kind):
    """Pin type: real, int, bool, string, name, vector, rotator, obj:<class path>, class:<class path>."""
    if kind == "vector":
        return L.get_struct_type(unreal.Vector.static_struct())
    if kind == "rotator":
        return L.get_struct_type(unreal.Rotator.static_struct())
    if kind.startswith("obj:"):
        return L.get_object_reference_type(unreal.load_class(None, kind[4:]))
    if kind.startswith("class:"):
        return L.get_class_reference_type(unreal.load_class(None, kind[6:]))
    return L.get_basic_type_by_name(kind)


def _names(pins):
    return [str(p.get_pin_name()) for p in pins]


def _is_data(p):
    return str(p.get_pin_type_display_string()) not in ("Exec", "Delegate")


class Node(object):
    def __init__(self, n):
        self.n = n

    def o(self, name=None):
        """Output pin by name; default: ReturnValue, else the first data output."""
        outs = list(self.n.list_output_pins())
        want = name or ("ReturnValue" if "ReturnValue" in _names(outs) else None)
        if want:
            for p in outs:
                if str(p.get_pin_name()) == want:
                    return p
            raise AssertionError("no output pin %s on %s (has %s)" % (want, L.get_node_title(self.n), _names(outs)))
        outs = [p for p in outs if _is_data(p)]
        assert outs, "no data output on %s" % L.get_node_title(self.n)
        return outs[0]

    def i(self, name):
        for p in self.n.list_input_pins():
            if str(p.get_pin_name()) == name:
                return p
        raise AssertionError("no input pin %s on %s (has %s)" % (name, L.get_node_title(self.n), _names(self.n.list_input_pins())))


def _pin(v):
    if isinstance(v, Node):
        return v.o()
    return v


class Graph(object):
    def __init__(self, bp, ed, cursor, row=0):
        self.bp, self.ed, self.cur = bp, ed, list(cursor)
        self.k = 0
        self.row = row

    # ---------- layout ----------
    def _place(self, n):
        try:
            L.set_node_pos(n, unreal.IntPoint(300 + (self.k % 14) * 320, self.row + (self.k // 14) * 260))
        except Exception:
            pass
        self.k += 1

    # ---------- wiring ----------
    def _exec(self, n):
        if TRACE:
            log("  exec")
        ins = [p for p in n.list_input_pins() if str(p.get_pin_name()) == "execute"]
        if not ins:
            return
        for c in self.cur:
            assert c.try_create_connection(ins[0]), "exec link failed into %s" % L.get_node_title(n)
        th = [p for p in n.list_output_pins() if str(p.get_pin_name()) == "then"]
        self.cur = th[:1]

    def bind(self, node, kw):
        wires = [(k, v) for k, v in kw.items() if isinstance(v, (Node, unreal.BlueprintGraphPin))]
        lits = [(k, v) for k, v in kw.items() if not isinstance(v, (Node, unreal.BlueprintGraphPin))]
        for k, v in wires:
            src = _pin(v)
            dst = node.i(k)
            assert src.try_create_connection(dst), "wire failed: %s -> %s.%s" % (src.get_pin_name(), L.get_node_title(node.n), k)
        for k, v in lits:
            assert node.i(k).set_pin_value(lit(v)), "literal failed: %s.%s = %r" % (L.get_node_title(node.n), k, v)
        return node

    def _new(self, n, kw, target=None):
        if TRACE:
            log("node %s %s" % (L.get_node_title(n) if n else None, list(kw)))
        assert n, "node not created"
        self._place(n)
        if TRACE:
            log("  placed")
        node = Node(n)
        if target is not None:
            assert _pin(target).try_create_connection(node.i("self")), "target wire failed on %s" % L.get_node_title(n)
        self.bind(node, kw)
        self._exec(n)
        return node

    # ---------- nodes ----------
    def call(self, fn, target=None, **kw):
        n = self.ed.add_call_function_node(fpath(fn))
        assert n, "no function %s" % fpath(fn)
        return self._new(n, kw, target)

    def me(self, func, **kw):
        """Call a function defined on this Blueprint. Resolved on the skeleton class (updated as soon as a function
        graph is added), so no compile is needed between building a function and calling it."""
        pkg = self.bp.get_path_name().rsplit(".", 1)[0]
        name = self.bp.get_name()
        n = None
        for path in ("%s.SKEL_%s_C:%s" % (pkg, name, func), "%s:%s" % (L.generated_class(self.bp).get_path_name(), func)):
            n = self.ed.add_call_function_node(path)
            if n:
                break
        assert n, "no function %s on %s" % (func, name)
        return self._new(n, kw)

    def v(self, name, target=None, cls=""):
        n = self.ed.add_get_member_variable_node(name, cls)
        assert n, "no variable %s %s" % (name, cls)
        return self._new(n, {}, target)

    def s(self, name, value, target=None, cls=""):
        n = self.ed.add_set_member_variable_node(name, cls)
        assert n, "no variable %s %s" % (name, cls)
        node = Node(n)
        self._place(n)
        if target is not None:
            assert _pin(target).try_create_connection(node.i("self")), "target wire failed on set %s" % name
        self.bind(node, {name: value})
        self._exec(n)
        return node

    def arr(self, *items):
        """Make Array node from wired values (e.g. ActorsToIgnore for a trace)."""
        n = self.ed.create_node_from_name("Utilities|Array|MakeArray", unreal.Vector2D(0, 0), [])
        assert n, "MakeArray"
        for _ in items[1:]:
            self.ed.add_node_pin(n)
        self._place(n)
        node = Node(n)
        for k, it in enumerate(items):
            assert _pin(it).try_create_connection(node.i("[%d]" % k)), "MakeArray item %d" % k
        return node

    def inc(self, name, by=1):
        return self.s(name, self.iadd(self.v(name), by))

    def ret(self):
        self.cur = []

    # ---------- control flow ----------
    def if_(self, cond):
        return _If(self, cond)

    def else_(self, br):
        return _Else(self, br)

    def for_(self, first, last):
        return _For(self, first, last)

    # ---------- shorthands ----------
    def f(self, fn, **kw):
        return self.call("KismetMathLibrary." + fn, **kw)

    def add(self, a, b): return self.f("Add_DoubleDouble", A=a, B=b)
    def sub(self, a, b): return self.f("Subtract_DoubleDouble", A=a, B=b)
    def mul(self, a, b): return self.f("Multiply_DoubleDouble", A=a, B=b)
    def div(self, a, b): return self.f("Divide_DoubleDouble", A=a, B=b)
    def gt(self, a, b): return self.f("Greater_DoubleDouble", A=a, B=b)
    def ge(self, a, b): return self.f("GreaterEqual_DoubleDouble", A=a, B=b)
    def lt(self, a, b): return self.f("Less_DoubleDouble", A=a, B=b)
    def le(self, a, b): return self.f("LessEqual_DoubleDouble", A=a, B=b)
    def ieq(self, a, b): return self.f("EqualEqual_IntInt", A=a, B=b)
    def ine(self, a, b): return self.f("NotEqual_IntInt", A=a, B=b)
    def igt(self, a, b): return self.f("Greater_IntInt", A=a, B=b)
    def ilt(self, a, b): return self.f("Less_IntInt", A=a, B=b)
    def ile(self, a, b): return self.f("LessEqual_IntInt", A=a, B=b)
    def iadd(self, a, b): return self.f("Add_IntInt", A=a, B=b)
    def isub(self, a, b): return self.f("Subtract_IntInt", A=a, B=b)
    def and_(self, a, b): return self.f("BooleanAND", A=a, B=b)
    def or_(self, a, b): return self.f("BooleanOR", A=a, B=b)
    def not_(self, a): return self.f("Not_PreBool", A=a)
    def vadd(self, a, b): return self.f("Add_VectorVector", A=a, B=b)
    def vsub(self, a, b): return self.f("Subtract_VectorVector", A=a, B=b)
    def vmul(self, a, s): return self.f("Multiply_VectorFloat", A=a, B=s)
    def vec(self, x=0.0, y=0.0, z=0.0): return self.f("MakeVector", X=x, Y=y, Z=z)
    def rot(self, pitch=0.0, yaw=0.0, roll=0.0): return self.f("MakeRotator", Roll=roll, Pitch=pitch, Yaw=yaw)
    def dist(self, a, b): return self.f("Vector_Distance", V1=a, V2=b)
    def now(self): return self.call("KismetSystemLibrary.GetGameTimeInSeconds")
    def since(self, var): return self.sub(self.now(), self.v(var))
    def valid(self, obj): return self.call("KismetSystemLibrary.IsValid", Object=obj)
    def loc(self, actor=None): return self.call("Actor.K2_GetActorLocation", target=actor)

    def say(self, text, screen=True, log=True, secs=2.0, color=None, key=None):
        kw = dict(InString=text, bPrintToScreen=screen, bPrintToLog=log, Duration=secs)
        if key:
            kw["Key"] = key
        if color:
            kw["TextColor"] = "(R=%s,G=%s,B=%s,A=1)" % tuple(_num(float(c)) for c in color)
        return self.call("KismetSystemLibrary.PrintString", **kw)

    def cat(self, *parts):
        """String concatenation; non-literal parts must already be strings (str_f / str_i)."""
        cur = parts[0]
        for p in parts[1:]:
            cur = self.call("KismetStringLibrary.Concat_StrStr", A=cur, B=p)
        return cur

    def str_f(self, x): return self.call("KismetStringLibrary.Conv_DoubleToString", InDouble=x)
    def str_i(self, x): return self.call("KismetStringLibrary.Conv_IntToString", InInt=x)
    def trunc(self, x): return self.f("FTrunc", A=x)


class _If(object):
    def __init__(self, g, cond):
        self.g, self.cond = g, cond

    def __enter__(self):
        g = self.g
        n = g.ed.add_branch_node()
        g._place(n)
        self.node = Node(n)
        g.bind(self.node, {"Condition": self.cond})
        g._exec(n)                                  # cursor -> [then]
        self.else_pin = self.node.o("else")
        return self

    def __exit__(self, *a):
        if a[0]:
            return False
        self.then_ends = list(self.g.cur)
        self.g.cur = self.then_ends + [self.else_pin]
        return False


class _Else(object):
    def __init__(self, g, br):
        self.g, self.br = g, br

    def __enter__(self):
        self.g.cur = [self.br.else_pin]
        return self

    def __exit__(self, *a):
        if a[0]:
            return False
        self.g.cur = self.br.then_ends + list(self.g.cur)
        return False


class _For(object):
    def __init__(self, g, first, last):
        self.g, self.first, self.last = g, first, last

    def __enter__(self):
        g = self.g
        n = g.ed.add_macro_node("/Engine/EditorBlueprintResources/StandardMacros.StandardMacros:ForLoop")
        assert n, "ForLoop macro"
        g._place(n)
        self.node = Node(n)
        g.bind(self.node, {"FirstIndex": self.first, "LastIndex": self.last})
        for c in g.cur:
            assert c.try_create_connection(self.node.i("execute")), "exec link failed into ForLoop"
        g.cur = [self.node.o("LoopBody")]
        return self.node.o("Index")

    def __exit__(self, *a):
        if a[0]:
            return False
        self.g.cur = [self.node.o("Completed")]
        return False


# ---------- Blueprint level ----------
def event_editor(bp):
    return GE.get_graph_editor(L.find_event_graph(bp))


def _subobjects(bp):
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    out = []
    for h in sds.k2_gather_subobject_data_for_blueprint(bp):
        d = sds.k2_find_subobject_data_from_handle(h)
        out.append((h, d, unreal.SubobjectDataBlueprintFunctionLibrary.get_associated_object(d)))
    return sds, out


def new_bp(path, parent):
    """Creates the Blueprint from scratch. An existing one is deleted first (force delete: references in levels are
    cleared, which is why place_bots.py runs after the make_* scripts and re-places every tagged actor).
    Emptying it in place through SubobjectDataSubsystem hit engine ensures and a crash on 5.8.3, so it is not used."""
    eal = unreal.EditorAssetLibrary
    if eal.does_asset_exist(path):
        ad = eal.find_asset_data(path)
        fn = unreal.Paths.convert_relative_path_to_full(
            unreal.Paths.combine([unreal.Paths.project_content_dir(), path[len("/Game/"):] + ".uasset"]))
        if not ad.is_asset_loaded() and os.path.isfile(fn):
            # Headless runs: remove the file before anything loads it. Force-deleting a loaded Blueprint and creating
            # a new one at the same path made the next save assert in GC on 5.8.3.
            os.remove(fn)
            unreal.AssetRegistryHelpers.get_asset_registry().scan_files_synchronous([fn], True)
        else:
            assert eal.delete_asset(path), "could not delete %s (open in an editor?)" % path
            unreal.SystemLibrary.collect_garbage()
    bp = L.create_blueprint_asset_with_parent(path, parent)
    assert bp, "could not create %s" % path
    return bp


def var(bp, name, kind, default=None, editable=True, category="OV"):
    ed = event_editor(bp)
    d = "" if default is None else (default.var_lit() if isinstance(default, (V, R)) else lit(default))
    assert ed.add_member_variable(name, T(kind), d), "add var %s" % name
    if editable:
        L.set_blueprint_variable_instance_editable(bp, name, True)
    try:
        L.set_blueprint_variable_category(bp, name, unreal.Text(category))
    except Exception:
        pass


def event(bp, name, row=0):
    ev = L.add_event_override(bp, name, unreal.IntPoint(0, row))
    assert ev, "event %s" % name
    g = Graph(bp, event_editor(bp), [Node(ev).o("then")], row)
    g.ev = Node(ev)
    return g


def function(bp, name, inputs=()):
    """New function graph; inputs = [(name, kind)]. Returns (Graph, {input name: pin})."""
    if TRACE:
        log("function %s" % name)
    ed = GE.create_and_edit_function_graph(bp, name)
    for n, kind in inputs:
        if TRACE:
            log("  input %s %s" % (n, kind))
        ed.add_graph_input_parameter(n, T(kind), "")
    entry_exec = ed.find_graph_entry_pin()          # re-fetched: adding parameters rebuilds the entry node's pins
    if TRACE:
        log("  entry %s" % entry_exec.is_valid())
    # get_owning_node() on the entry pin crashed on 5.8.3 after a compile; find the entry node by class instead.
    entry = Node([nd for nd in ed.list_all_nodes() if isinstance(nd, unreal.K2Node_FunctionEntry)][0])
    pins = {n: entry.o(n) for n, _ in inputs}
    g = Graph(bp, ed, [entry_exec])
    return g, pins


def add_component(bp, cls, name, parent_name=None):
    """Adds a component to the Blueprint (SubobjectDataSubsystem). Returns the component template."""
    sds, subs = _subobjects(bp)
    parent = subs[0][0]
    lib = unreal.SubobjectDataBlueprintFunctionLibrary
    for h, d, o in subs[1:]:
        if parent_name:
            if o and o.get_name().split("_GEN_VARIABLE")[0] == parent_name:
                parent = h
                break
        elif lib.is_root_component(d):       # DefaultSceneRoot or the native root (a Character's capsule)
            parent = h
            break
    h, fail = sds.add_new_subobject(unreal.AddNewSubobjectParams(parent_handle=parent, new_class=cls, blueprint_context=bp))
    assert not str(fail), "add component %s: %s" % (name, fail)
    sds.rename_subobject(h, unreal.Text(name))
    d = sds.k2_find_subobject_data_from_handle(h)
    return lib.get_associated_object(d)


def compile_bp(bp):
    L.compile_blueprint(bp)
    errs = []
    for gr in L.list_graphs(bp):
        try:
            ed = GE.get_graph_editor(gr)
            for n in ed.list_nodes_with_errors():
                errs.append("%s: %s" % (gr.get_name(), L.get_node_title(n)))
        except Exception:
            pass
    try:
        bad = bp.get_editor_property("status") == unreal.BlueprintStatus.BS_ERROR
    except Exception:
        bad = False
    if errs or bad:
        raise RuntimeError("Blueprint %s does not compile: %s" % (bp.get_path_name(), errs))
    unreal.EditorAssetLibrary.save_loaded_asset(bp)
    return True
