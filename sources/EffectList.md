## 引

- 在 react 的 commit 阶段， 它并不会遍历整个 fiber 树，而是`effect list`
- 而 effect list 是在 completeWork 中串起来的， 这个列表包含了所有 flags !== NoFlags(0)的 fiber 节点

在这两个前提下， 我们需要搞清楚

1. fiber.flags 都是在什么地方赋值的？
2. completeWork 具体如何串起这些 fiber 节点的?

## flags

我们要区分 mount/update 两种情况

### mount 时

1. **只有** HostRoot.child 会在 Diff 算法中追踪副作用， 最终标记 flags = Placement = 2;
   函数

2. 函数组件如果使用了 useEffect Hook, 会在执行时标记 flags = Update(4) | PassiveEffect(512) = 516

其他一些特殊情况暂时不考虑， 那么在初次渲染后， commitWork 拿到的 Effect List 应该只包括 HostRoot.child, 以及所有使用了 useEffect 的函数组件

### update 时

1. Diff 算法里会判断新 fiber 是否复用了之前的 fiber 节点(通过新 fiber.alternate), 若没有复用则标记 flags = Placement = 2,
   相对的, 对于需要被删除的 fiber 节点, 会标记 flags = Deletion = 8
2. 函数组件， 使用了 useEffect 的， 和 mount 时的逻辑一样。
3. 原生组件， 在 completeWork 内会判断是否有更新（diff properties）， 然后标记 flags = Update = 4

## Effect list 生命周期

### 产出 Effect List

在 completeWork 函数中， 对每个进入 completeWork 阶段的 fiber， 需要处理关于 EffectList 的两个部分的逻辑:

1. 处理当前 fiber 的 effect list, 这一步主要是围绕 fiber.[firstEffect/lastEffect]这两个指针。

   - 若父级没有 effect list, 也就是不存在 firstEffect/lastEffect 指针， 则
     ```js
     fiber.return.firstEffect = fiber.firstEffect;
     fiber.return.lastEffect = fiber.lastEffect;
     ```
   - 若父级存在 effect list, 也就是存在 firstEffect/lastEffect 指针， 则

     ```js
     fiber.return.lastEffect.next = fiber.firstEffect;
     fiber.return.lastEffect = fiber.lastEffect;
     ```

2. 处理当前 fiber 节点， 这里检测当前节点的 flags, 若 fiber.flags !== NoFlags:

   - 若父级没有 lastEffect
     ```
     fiber.return.firstEffect = fiber;
     fiber.return.lastEffect = fiber;
     ```
   - 若父级有 lastEffect
     ```
     fiber.return.lastEffect.next = fiber;
     fiber.return.lastEffect = fiber;
     ```

   可以看到， 当前节点总是加到父级的 Effect List 的末端

Diff 算法里， 也会在 deleteChild 函数中降需要删除的节点添加到其父级的 Effect list 中， 和上面第二步相仿， 这里不再赘述。

另外在 commitWork 阶段， 会判断 HostRoot 上是否有 flags（一般会有， flags = Snapshot, 在 HostRoot 节点执行 completeWork 时标记的）， 若存在则把 HostRoot 节点加入到 Effect List 的末端。

### 消费 Effect List

commitWork 阶段的三个循环消费 Effect List

### 删除 Effect List

- 若 Effect List 上存在带 Passive flag 的节点， 则在 flushPassiveEffects 末端清除 Effect List
- 若 Effect List 上没有带 Passive flag 的节点， 则在 commitWork 末端清除 Effect List
