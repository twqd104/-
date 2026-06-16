import * as THREE from 'three';

export interface Command {
    execute(): void;
    undo(): void;
}

export class HistoryManager {
    private undoStack: Command[] = [];
    private redoStack: Command[] = [];

    // Optional callback to trigger UI updates when history changes
    public onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;

    public execute(command: Command) {
        command.execute();
        this.undoStack.push(command);
        this.redoStack = []; // Clear redo stack on new action
        this.notify();
    }

    public undo() {
        if (this.undoStack.length === 0) return;
        const command = this.undoStack.pop()!;
        command.undo();
        this.redoStack.push(command);
        this.notify();
    }

    public redo() {
        if (this.redoStack.length === 0) return;
        const command = this.redoStack.pop()!;
        command.execute();
        this.undoStack.push(command);
        this.notify();
    }
    
    public addCommand(command: Command) {
        this.undoStack.push(command);
        this.redoStack = [];
        this.notify();
    }
    
    public clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.notify();
    }
    
    private notify() {
        if (this.onHistoryChange) {
            this.onHistoryChange(this.undoStack.length > 0, this.redoStack.length > 0);
        }
    }
}

// ---- Concrete Command Data Structures ----

export class MoveCommand implements Command {
    object: THREE.Object3D;
    oldPosition: THREE.Vector3;
    newPosition: THREE.Vector3;
    updateUI: () => void;

    constructor(
        object: THREE.Object3D,
        oldPosition: THREE.Vector3,
        newPosition: THREE.Vector3,
        updateUI: () => void
    ) {
        this.object = object;
        this.oldPosition = oldPosition;
        this.newPosition = newPosition;
        this.updateUI = updateUI;
    }
    
    execute() {
        this.object.position.copy(this.newPosition);
        this.updateUI();
    }
    undo() {
        this.object.position.copy(this.oldPosition);
        this.updateUI();
    }
}

export class TransformCommand implements Command {
    object: THREE.Object3D;
    oldScale: THREE.Vector3;
    newScale: THREE.Vector3;
    oldRotation: THREE.Euler;
    newRotation: THREE.Euler;
    oldPosition: THREE.Vector3;
    newPosition: THREE.Vector3;
    updateUI: () => void;

    constructor(
        object: THREE.Object3D,
        oldScale: THREE.Vector3,
        newScale: THREE.Vector3,
        oldRotation: THREE.Euler,
        newRotation: THREE.Euler,
        oldPosition: THREE.Vector3,
        newPosition: THREE.Vector3,
        updateUI: () => void
    ) {
        this.object = object;
        this.oldScale = oldScale;
        this.newScale = newScale;
        this.oldRotation = oldRotation;
        this.newRotation = newRotation;
        this.oldPosition = oldPosition;
        this.newPosition = newPosition;
        this.updateUI = updateUI;
    }

    execute() {
        this.object.scale.copy(this.newScale);
        this.object.rotation.copy(this.newRotation);
        this.object.userData.originalY = this.newPosition.y;
        this.object.position.copy(this.newPosition);
        this.updateUI();
    }
    undo() {
        this.object.scale.copy(this.oldScale);
        this.object.rotation.copy(this.oldRotation);
        this.object.userData.originalY = this.oldPosition.y;
        this.object.position.copy(this.oldPosition);
        this.updateUI();
    }
}

export class SpawnCommand implements Command {
    object: THREE.Object3D;
    scene: THREE.Scene;
    draggableList: THREE.Object3D[];
    onAdd: (obj: THREE.Object3D) => void;
    onRemove: (obj: THREE.Object3D) => void;

    constructor(
        object: THREE.Object3D,
        scene: THREE.Scene,
        draggableList: THREE.Object3D[],
        onAdd: (obj: THREE.Object3D) => void,
        onRemove: (obj: THREE.Object3D) => void
    ) {
        this.object = object;
        this.scene = scene;
        this.draggableList = draggableList;
        this.onAdd = onAdd;
        this.onRemove = onRemove;
    }

    execute() {
        this.scene.add(this.object);
        if (!this.draggableList.includes(this.object)) {
            this.draggableList.push(this.object);
        }
        this.onAdd(this.object);
    }
    undo() {
        this.scene.remove(this.object);
        const index = this.draggableList.indexOf(this.object);
        if (index > -1) {
            this.draggableList.splice(index, 1);
        }
        this.onRemove(this.object);
    }
}

export class DeleteCommand implements Command {
    object: THREE.Object3D;
    scene: THREE.Scene;
    draggableList: THREE.Object3D[];
    onAdd: (obj: THREE.Object3D) => void;
    onRemove: (obj: THREE.Object3D) => void;

    constructor(
        object: THREE.Object3D,
        scene: THREE.Scene,
        draggableList: THREE.Object3D[],
        onAdd: (obj: THREE.Object3D) => void,
        onRemove: (obj: THREE.Object3D) => void
    ) {
        this.object = object;
        this.scene = scene;
        this.draggableList = draggableList;
        this.onAdd = onAdd;
        this.onRemove = onRemove;
    }

    execute() {
        this.scene.remove(this.object);
        const index = this.draggableList.indexOf(this.object);
        if (index > -1) {
            this.draggableList.splice(index, 1);
        }
        this.onRemove(this.object);
    }
    undo() {
        this.scene.add(this.object);
        if (!this.draggableList.includes(this.object)) {
            this.draggableList.push(this.object);
        }
        this.onAdd(this.object);
    }
}

export class ColorCommand implements Command {
    object: THREE.Object3D;
    oldColor: string;
    newColor: string;
    updateUI: () => void;

    constructor(
        object: THREE.Object3D,
        oldColor: string,
        newColor: string,
        updateUI: () => void
    ) {
        this.object = object;
        this.oldColor = oldColor;
        this.newColor = newColor;
        this.updateUI = updateUI;
    }

    private applyColor(colorHex: string) {
        let appliedMesh = false;
        this.object.traverse((child) => {
            if (!appliedMesh && child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                if (!child.userData.isCustomImage) {
                    child.material.color.set(colorHex);
                    if (child.material.emissive && child.material.emissiveIntensity > 0) {
                        child.material.emissive.set(colorHex);
                    }
                    appliedMesh = true; 
                }
            }
            if (child instanceof THREE.Light && child.userData.isLampLight) {
                child.color.set(colorHex);
            }
        });
    }

    execute() {
        this.applyColor(this.newColor);
        this.updateUI();
    }
    undo() {
        this.applyColor(this.oldColor);
        this.updateUI();
    }
}

export class MultiTransformCommand implements Command {
    transforms: Array<{
        object: THREE.Object3D;
        oldPosition: THREE.Vector3;
        oldRotation: THREE.Euler;
        newPosition: THREE.Vector3;
        newRotation: THREE.Euler;
    }>;
    updateUI: () => void;

    constructor(
        transforms: Array<{
            object: THREE.Object3D;
            oldPosition: THREE.Vector3;
            oldRotation: THREE.Euler;
            newPosition: THREE.Vector3;
            newRotation: THREE.Euler;
        }>,
        updateUI: () => void
    ) {
        this.transforms = transforms;
        this.updateUI = updateUI;
    }

    execute() {
        for (const t of this.transforms) {
            t.object.position.copy(t.newPosition);
            t.object.rotation.copy(t.newRotation);
            t.object.userData.originalY = t.newPosition.y;
        }
        this.updateUI();
    }

    undo() {
        for (const t of this.transforms) {
            t.object.position.copy(t.oldPosition);
            t.object.rotation.copy(t.oldRotation);
            t.object.userData.originalY = t.oldPosition.y;
        }
        this.updateUI();
    }
}
